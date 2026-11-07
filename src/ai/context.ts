// Welches Material gehört zur aktiven Hälfte (offene Notiz oder PDF) – und wie wird es zu Text?
import { loadPageContent, loadPageTexts, loadPdfFile, type Page, type PdfDoc } from "../storage/db";
import { generalPages, resolvePageId } from "../sections/notes/NotesContext";
import { getDocument } from "../sections/pdfs/pdfjs";
import { parseSelection } from "../sections/uni/selection";
import type { Attachment } from "./gemini";

export type AiSource =
  | { kind: "note"; id: string; title: string }
  | { kind: "pdf"; id: string; title: string };

// Aus dem, was in der aktiven Hälfte offen ist, die Quelle bestimmen (oder null).
export function findSource(
  sectionId: string,
  selectedId: string | null,
  pages: Page[],
  pdfs: PdfDoc[],
): AiSource | null {
  const note = (id: string | null) => {
    const page = pages.find((p) => p.id === id);
    return page ? ({ kind: "note", id: page.id, title: page.title || "Ohne Titel" } as const) : null;
  };
  if (sectionId === "notes") return note(resolvePageId(generalPages(pages), selectedId));
  if (sectionId === "uni") {
    const selection = parseSelection(selectedId);
    return selection.kind === "page" ? note(selection.id) : null;
  }
  if (sectionId === "pdfs") {
    const pdf = pdfs.find((p) => p.id === selectedId);
    return pdf ? { kind: "pdf", id: pdf.id, title: pdf.name } : null;
  }
  return null;
}

// PDFs: Es wird nur der gewählte Seitenbereich mitgeschickt – als Text. Haben die Seiten kaum Text
// (eingescannt), gehen sie als Bilder mit (dann höchstens MAX_IMAGE_PAGES Seiten).
// Grenzen so gewählt, dass eine Anfrage sicher in die Gratis-Stufe von Gemini passt.
export const MAX_TEXT_CHARS = 200_000; // grob 30.000 Wörter
export const MAX_IMAGE_PAGES = 20;

export type PageRange = { from: number; to: number }; // Seiten ab 1, einschließlich

export class AttachmentTooLargeError extends Error {}

export async function loadAttachment(source: AiSource, range?: PageRange): Promise<Attachment> {
  if (source.kind === "note") {
    const blocks = (await loadPageContent(source.id)) ?? [];
    const boxes = (await loadPageTexts(source.id)).map((t) => t.text.trim()).filter(Boolean);
    const text = [blocksToText(blocks).trim(), ...boxes.map((t) => `[Textfeld] ${t}`)].filter(Boolean).join("\n\n");
    return { kind: "text", label: `Notiz „${source.title}“`, text: text || "(Die Notiz ist leer.)" };
  }

  const file = await loadPdfFile(source.id);
  if (!file) throw new Error("Die PDF-Datei wurde nicht gefunden.");
  const pages = await pdfPageTexts(source.id, file);
  const from = Math.max(1, Math.min(range?.from ?? 1, pages.length));
  const to = Math.max(from, Math.min(range?.to ?? pages.length, pages.length));
  const label = `PDF „${source.title}“, ${from === to ? `Seite ${from}` : `Seiten ${from}–${to}`}`;
  const chosen = pages.slice(from - 1, to);

  const text = chosen.map((pageText, i) => `--- Seite ${from + i} ---\n${pageText}`).join("\n\n");
  const letters = chosen.join("").replace(/\s/g, "").length;
  if (letters > 50 * chosen.length) {
    // genug echter Text
    if (text.length > MAX_TEXT_CHARS) {
      throw new AttachmentTooLargeError(
        `Die Seiten ${from}–${to} enthalten zu viel Text für eine Anfrage. Bitte weniger Seiten wählen ` +
          `(z. B. ein Kapitel, etwa ${Math.max(1, Math.floor((MAX_TEXT_CHARS / text.length) * chosen.length))} Seiten).`,
      );
    }
    return { kind: "text", label, text };
  }
  // Eingescannt: Seiten als Bilder.
  if (chosen.length > MAX_IMAGE_PAGES) {
    throw new AttachmentTooLargeError(
      `Diese Seiten sind eingescannt (kein lesbarer Text) – dann gehen höchstens ${MAX_IMAGE_PAGES} Seiten auf einmal. Bitte weniger Seiten wählen.`,
    );
  }
  return { kind: "images", label, images: await renderPageImages(file, from, to) };
}

// Wie viele Seiten hat das PDF? (aus dem Zwischenspeicher, sonst kurz öffnen)
export async function pdfPageCount(pdfId: string): Promise<number> {
  const file = await loadPdfFile(pdfId);
  return file ? (await pdfPageTexts(pdfId, file)).length : 0;
}

// ---------- Notiz (Editor-Blöcke) → Text ----------
type AnyBlock = { type?: string; props?: Record<string, unknown>; content?: unknown; children?: AnyBlock[] };

function blocksToText(blocks: unknown[], depth = 0): string {
  return (blocks as AnyBlock[])
    .map((block) => {
      const text = inlineText(block.content);
      const indent = "  ".repeat(depth);
      let line = text;
      if (block.type === "heading") line = `${"#".repeat(Number(block.props?.level) || 1)} ${text}`;
      else if (block.type === "bulletListItem") line = `- ${text}`;
      else if (block.type === "numberedListItem") line = `1. ${text}`;
      else if (block.type === "checkListItem") line = `[${block.props?.checked ? "x" : " "}] ${text}`;
      else if (block.type === "image") line = "[Bild]";
      const children = block.children?.length ? "\n" + blocksToText(block.children, depth + 1) : "";
      return indent + line + children;
    })
    .join("\n");
}

// Sammelt alle Texte aus dem Inhalt eines Blocks (auch aus Links und Tabellen).
function inlineText(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(inlineText).join("");
  if (typeof content === "object") {
    const item = content as { type?: string; text?: string; content?: unknown; rows?: { cells: unknown[] }[] };
    if (item.type === "tableContent" && item.rows) {
      return item.rows.map((row) => row.cells.map(inlineText).join(" | ")).join("\n");
    }
    if (typeof item.text === "string") return item.text;
    return inlineText(item.content);
  }
  return "";
}

// ---------- PDF → Text pro Seite (mit pdf.js, Ergebnis wird zwischengespeichert) ----------
const pdfTextCache = new Map<string, string[]>(); // PDF-Kennung -> Text jeder Seite

async function pdfPageTexts(id: string, file: Blob): Promise<string[]> {
  const cached = pdfTextCache.get(id);
  if (cached) return cached;
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
        .join("");
      pages.push(text.trim());
    }
    pdfTextCache.set(id, pages);
    return pages;
  } finally {
    await task.destroy();
  }
}

// Eingescannte Seiten als JPEG-Bilder (Base64), gut lesbar aber nicht zu groß.
async function renderPageImages(file: Blob, from: number, to: number): Promise<string[]> {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const doc = await task.promise;
    const images: string[] = [];
    for (let n = from; n <= to; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, 1400 / base.width) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, viewport }).promise;
      images.push(canvas.toDataURL("image/jpeg", 0.75).split(",")[1] ?? "");
      canvas.width = canvas.height = 0; // Speicher freigeben
    }
    return images;
  } finally {
    await task.destroy();
  }
}
