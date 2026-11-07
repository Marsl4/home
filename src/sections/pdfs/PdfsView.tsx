// Hauptansicht im PDF-Bereich: geöffnetes PDF oder Startseite zum Importieren.
// PDFs können auch einfach per Drag & Drop hierher gezogen werden.
import { useState } from "react";
import { FileText, Upload } from "lucide-react";

import type { SectionProps } from "../types";
import { ImportPdfButton } from "./ImportPdfButton";
import { usePdfs } from "./PdfsContext";
import { PdfViewer } from "./PdfViewer";

export function PdfsView({ selectedId, onSelect }: SectionProps) {
  const { pdfs, importFiles, updatePdf } = usePdfs();
  const pdf = pdfs.find((p) => p.id === selectedId);
  const [dragging, setDragging] = useState(false);

  const openFirst = (added: { id: string }[]) => {
    if (!added[0]) return;
    updatePdf(added[0].id, { lastOpenedAt: Date.now() });
    onSelect(added[0].id);
  };

  return (
    <div
      className={`pdfs ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDragging(false);
        openFirst(await importFiles(Array.from(e.dataTransfer.files)));
      }}
    >
      {pdf ? (
        <PdfViewer key={pdf.id} pdf={pdf} />
      ) : (
        <div className="placeholder-view">
          <div className="placeholder-icon">
            <FileText size={32} strokeWidth={1.5} />
          </div>
          <h1>{pdfs.length ? "Wähle ein PDF aus" : "Noch keine PDFs"}</h1>
          <p>PDF hierher ziehen oder importieren – danach kannst du darauf schreiben.</p>
          <ImportPdfButton className="primary-button" onImported={openFirst}>
            <Upload size={16} /> PDF importieren
          </ImportPdfButton>
        </div>
      )}
    </div>
  );
}
