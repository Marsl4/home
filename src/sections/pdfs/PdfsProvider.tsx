// Lädt die PDF-Liste und stellt Funktionen zum Importieren/Ändern/Löschen bereit.
import { useEffect, useState, type ReactNode } from "react";

import { deletePdfData, loadPdfs, savePdfFile, savePdfs, type PdfDoc } from "../../storage/db";
import { useLiveSync } from "../../storage/liveSync";
import { PdfsContext } from "./PdfsContext";

export function PdfsProvider({ children }: { children: ReactNode }) {
  const [pdfs, setPdfs] = useState<PdfDoc[] | null>(null); // null = lädt noch
  useLiveSync<PdfDoc[]>("pdfs", setPdfs); // vom anderen Gerät (Sync)

  useEffect(() => {
    loadPdfs().then(setPdfs);
  }, []);

  if (pdfs === null) return null;

  // Jede Änderung baut auf dem neuesten Stand auf (wichtig, wenn mehrere direkt nacheinander kommen)
  // und wird sofort gespeichert.
  const update = (change: (current: PdfDoc[]) => PdfDoc[]) =>
    setPdfs((current) => {
      const next = change(current ?? []);
      savePdfs(next);
      return next;
    });

  const importFiles = async (files: File[]) => {
    const added: PdfDoc[] = [];
    for (const file of files) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) continue;
      const doc: PdfDoc = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.pdf$/i, ""),
        addedAt: Date.now(),
        lastOpenedAt: null,
        favorite: false,
      };
      await savePdfFile(doc.id, file);
      added.push(doc);
    }
    if (added.length) update((current) => [...current, ...added]);
    return added;
  };

  const updatePdf = (id: string, changes: Partial<PdfDoc>) =>
    update((current) => current.map((p) => (p.id === id ? { ...p, ...changes } : p)));

  const deletePdf = (id: string) => {
    update((current) => current.filter((p) => p.id !== id));
    deletePdfData(id);
  };

  return (
    <PdfsContext.Provider value={{ pdfs, importFiles, updatePdf, deletePdf }}>
      {children}
    </PdfsContext.Provider>
  );
}
