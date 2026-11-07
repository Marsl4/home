// Gemeinsamer Zustand des PDF-Bereichs (Liste der PDFs), den Leiste und Ansicht brauchen.
import { createContext, useContext } from "react";
import type { PdfDoc } from "../../storage/db";

export type PdfsState = {
  pdfs: PdfDoc[];
  importFiles: (files: File[], folderId?: string | null) => Promise<PdfDoc[]>; // gibt die neuen PDFs zurück
  updatePdf: (id: string, changes: Partial<PdfDoc>) => void;
  deletePdf: (id: string) => void;
};

export const PdfsContext = createContext<PdfsState | null>(null);

export function usePdfs(): PdfsState {
  const pdfs = useContext(PdfsContext);
  if (!pdfs) throw new Error("usePdfs muss innerhalb von <PdfsProvider> benutzt werden");
  return pdfs;
}

// Filter oben in der Leiste.
export type PdfFilter = "all" | "recent" | "favorites";

export const PDF_FILTERS: { id: PdfFilter; label: string }[] = [
  { id: "all", label: "Alle" },
  { id: "recent", label: "Zuletzt" },
  { id: "favorites", label: "Favoriten" },
];

export function filterPdfs(pdfs: PdfDoc[], filter: PdfFilter): PdfDoc[] {
  switch (filter) {
    case "all":
      return [...pdfs].sort((a, b) => a.name.localeCompare(b.name, "de"));
    case "recent":
      return pdfs
        .filter((p) => p.lastOpenedAt)
        .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0));
    case "favorites":
      return pdfs.filter((p) => p.favorite).sort((a, b) => a.name.localeCompare(b.name, "de"));
  }
}
