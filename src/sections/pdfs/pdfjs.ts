// Einrichtung von pdf.js (Mozillas PDF-Bibliothek).
// Das eigentliche Lesen der PDF passiert in einem "Worker" (eigener Hintergrund-Prozess),
// damit die App dabei nicht ruckelt. Vite liefert uns dafür die Adresse der Worker-Datei.
// Wir nehmen die "legacy"-Ausgabe von pdf.js: Sie bringt Ergänzungen für ältere Browser mit
// (z. B. Safari auf iPadOS 17). Die normale Ausgabe läuft nur auf den allerneuesten Geräten.
import { getDocument, GlobalWorkerOptions, RenderingCancelledException } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

export { getDocument, RenderingCancelledException };
export type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
