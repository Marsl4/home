// Welches Material gehört zur aktiven Hälfte (offene Notiz oder PDF) – und wie wird es zu Text?
import { loadPageContent, loadPdfFile, type Page, type PdfDoc } from "../storage/db";
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

// Große PDFs werden als Text geschickt; nur wenn kaum Text drin ist (eingescannt),
// geht die Datei selbst mit – bis zu dieser Größe.
const MAX_INLINE_PDF_BYTES = 15 * 1024 * 1024;
const MAX_TEXT_CHARS = 400_000; // grob 100.000 Wörter – mehr schickt die App nicht mit

export async function loadAttachment(source: AiSource): Promise<Attachment> {
  if (source.kind === "note") {
    const blocks = (await loadPageContent(source.id)) ?? [];
    const text = blocksToText(blocks).trim();
    return { kind: "text", label: `Notiz „${source.title}“`, text: text || "(Die Notiz ist leer.)" };
  }

  const file = await loadPdfFile(source.id);
  if (!file) throw new Error("Die PDF-Datei wurde nicht gefunden.");
  const text = await pdfToText(source.id, file);
  if (text.replace(/\s/g, "").length > 200) {
    return { kind: "text", label: `PDF „${source.title}“`, text: text.slice(0, MAX_TEXT_CHARS) };
  }
  if (file.size > MAX_INLINE_PDF_BYTES) {
    throw new Error("Die PDF enthält keinen lesbaren Text und ist zu groß, um sie als Ganzes zu schicken.");
  }
  return { kind: "pdf", label: source.title, base64: await blobToBase64(file) };
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

// ---------- PDF → Text (mit pdf.js, Ergebnis wird zwischengespeichert) ----------
const pdfTextCache = new Map<string, string>(); // PDF-Kennung -> Text

async function pdfToText(id: string, file: Blob): Promise<string> {
  const cached = pdfTextCache.get(id);
  if (cached !== undefined) return cached;
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
        .join("");
      pages.push(`--- Seite ${n} ---\n${text.trim()}`);
    }
    const result = pages.join("\n\n");
    pdfTextCache.set(id, result);
    return result;
  } finally {
    await task.destroy();
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
