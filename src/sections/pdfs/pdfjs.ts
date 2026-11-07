// Einrichtung von pdf.js (Mozillas PDF-Bibliothek).
// Das eigentliche Lesen der PDF passiert in einem "Worker" (eigener Hintergrund-Prozess),
// damit die App dabei nicht ruckelt. Vite liefert uns dafür die Adresse der Worker-Datei.
import { getDocument, GlobalWorkerOptions, RenderingCancelledException } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

export { getDocument, RenderingCancelledException };
export type { PDFDocumentProxy } from "pdfjs-dist";
