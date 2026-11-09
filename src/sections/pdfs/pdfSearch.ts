// Suche im PDF: Text jeder Seite (einmal ausgelesen und gemerkt) + Treffer mit kurzem Textausschnitt.
import type { PDFDocumentProxy } from "./pdfjs";

export type SearchHit = { page: number; snippet: { before: string; match: string; after: string } }; // page ab 0

const textCache = new WeakMap<PDFDocumentProxy, Promise<string[]>>();

// Text aller Seiten (als ein String pro Seite).
export function pageTexts(doc: PDFDocumentProxy): Promise<string[]> {
  let cached = textCache.get(doc);
  if (!cached) {
    cached = (async () => {
      const texts: string[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const content = await (await doc.getPage(n)).getTextContent();
        texts.push(content.items.map((item) => ("str" in item ? item.str + (item.hasEOL ? " " : "") : "")).join(""));
      }
      return texts;
    })();
    textCache.set(doc, cached);
  }
  return cached;
}

// Groß-/Kleinschreibung egal, mehrere Leerzeichen wie eins.
export const normalize = (text: string) => text.toLocaleLowerCase("de").replace(/\s+/g, " ");

export async function searchPdf(doc: PDFDocumentProxy, query: string, limit = 300): Promise<SearchHit[]> {
  const needle = normalize(query.trim());
  if (needle.length < 2) return [];
  const texts = await pageTexts(doc);
  const hits: SearchHit[] = [];
  texts.forEach((raw, page) => {
    const text = raw.replace(/\s+/g, " ");
    const lower = normalize(text);
    let from = 0;
    while (hits.length < limit) {
      const index = lower.indexOf(needle, from);
      if (index === -1) break;
      hits.push({
        page,
        snippet: {
          before: (index > 40 ? "…" : "") + text.slice(Math.max(0, index - 40), index),
          match: text.slice(index, index + needle.length),
          after: text.slice(index + needle.length, index + needle.length + 50) + "…",
        },
      });
      from = index + needle.length;
    }
  });
  return hits;
}
