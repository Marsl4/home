// Export: Dateien aus der App auf den Mac/das iPad holen.
// - PDFs: die Original-Datei herunterladen (Mac: Ordner "Downloads"; iPad: "In Dateien sichern").
// - Notizen: über den Drucken-Dialog als PDF sichern (Text bleibt scharf und durchsuchbar).
import { loadPdfFile, type PdfDoc } from "./db";

// Dateinamen ohne Zeichen, die macOS/iPadOS nicht mögen.
export function safeFileName(name: string, fallback: string): string {
  return (name.trim() || fallback).replace(/[/\\:*?"<>|]+/g, "-").slice(0, 120);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000); // iPad braucht die Adresse noch einen Moment
}

export async function exportPdfFile(pdf: PdfDoc) {
  const file = await loadPdfFile(pdf.id);
  if (!file) throw new Error("Die PDF-Datei wurde nicht gefunden.");
  downloadBlob(file, `${safeFileName(pdf.name, "PDF")}.pdf`);
}

// Druckt nur dieses Element (eine Notizseite). Im Drucken-Dialog dann "Als PDF sichern" wählen.
// Die Druck-Regeln stehen in index.css (@media print, body.printing).
export function printElement(element: HTMLElement, title: string) {
  document.querySelectorAll(".print-target").forEach((el) => el.classList.remove("print-target"));
  element.classList.add("print-target");
  // Ohne Cursor im Editor (sonst wird der graue Hinweis "Text eingeben …" mitgedruckt).
  (document.activeElement as HTMLElement | null)?.blur();
  // Gedruckt wird in derselben Breite wie am Bildschirm (sonst bricht der Text anders um und
  // Zeichnungen säßen verschoben) – nur verkleinert, damit es auf A4 passt (~700 Pixel nutzbar).
  const content = element.querySelector<HTMLElement>(".page-content");
  const width = content?.offsetWidth ?? 700;
  element.style.setProperty("--print-width", `${width}px`);
  element.style.setProperty("--print-zoom", String(Math.min(1, 700 / width)));
  document.body.classList.add("printing");
  // Der Titel des Dokuments wird zum vorgeschlagenen Dateinamen.
  const previousTitle = document.title;
  document.title = safeFileName(title, "Notiz");
  const cleanup = () => {
    document.title = previousTitle;
    document.body.classList.remove("printing");
    element.classList.remove("print-target");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}
