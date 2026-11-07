// Hauptansicht im PDF-Bereich: Dokumenten-Übersicht (Ordner + PDFs als Kacheln) oder ein geöffnetes PDF.
// Auswahl: null = oberste Ebene, "folder:<id>" = Ordner, sonst die ID eines PDFs.
// PDFs können auch einfach per Drag & Drop hierher gezogen werden (landen im gerade offenen Ordner).
import { Fragment, useState } from "react";

import { useNotes } from "../notes/NotesContext";
import type { SectionProps } from "../types";
import { FolderBrowser } from "../uni/FolderBrowser";
import { folderPath } from "../uni/folders";
import { pdfFolderSelection, usePdfs } from "./PdfsContext";
import { PdfViewer } from "./PdfViewer";

export function PdfsView({ selectedId, onSelect }: SectionProps) {
  const { pdfs, importFiles, updatePdf } = usePdfs();
  const { subjects } = useNotes();
  const [dragging, setDragging] = useState(false);

  const folderId = selectedId?.startsWith("folder:") ? selectedId.slice(7) : null;
  const folder = folderId ? (subjects.find((s) => s.id === folderId) ?? null) : null;
  const pdf = folderId ? undefined : pdfs.find((p) => p.id === selectedId);

  const openPdf = (id: string) => {
    updatePdf(id, { lastOpenedAt: Date.now() });
    onSelect(id);
  };

  // Pfad über dem PDF: "PDFs › 7. Semester › Steuern"
  const breadcrumb = pdf && (
    <>
      <button className="breadcrumb-link" onClick={() => onSelect(null)}>
        PDFs
      </button>
      {folderPath(subjects, pdf.folderId).map((f) => (
        <Fragment key={f.id}>
          <span className="breadcrumb-separator">›</span>
          <button className="breadcrumb-link" onClick={() => onSelect(pdfFolderSelection(f.id))}>
            {f.name || "Ohne Namen"}
          </button>
        </Fragment>
      ))}
    </>
  );

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
        const added = await importFiles(Array.from(e.dataTransfer.files), pdf ? (pdf.folderId ?? null) : folder?.id ?? null);
        if (added[0]) openPdf(added[0].id);
      }}
    >
      {pdf ? (
        <PdfViewer key={pdf.id} pdf={pdf} breadcrumb={breadcrumb} />
      ) : (
        <FolderBrowser
          key={folder?.id ?? "root"}
          mode="pdfs"
          folder={folder}
          nav={{
            root: () => onSelect(null),
            folder: (id) => onSelect(pdfFolderSelection(id)),
            page: () => {},
            pdf: openPdf,
          }}
        />
      )}
    </div>
  );
}
