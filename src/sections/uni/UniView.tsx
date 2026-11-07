// Hauptansicht im Uni-Bereich: Dokumenten-Übersicht (Ordner-Kacheln), eine Notiz oder ein PDF.
import { Fragment } from "react";

import { useNotes } from "../notes/NotesContext";
import { PageView } from "../notes/PageView";
import { usePdfs } from "../pdfs/PdfsContext";
import { PdfViewer } from "../pdfs/PdfViewer";
import { PlaceholderView } from "../placeholder/PlaceholderView";
import type { SectionProps } from "../types";
import { FolderBrowser } from "./FolderBrowser";
import { folderPath } from "./folders";
import { pageSelection, parseSelection, pdfSelection, subjectSelection } from "./selection";

export function UniView(props: SectionProps) {
  const { selectedId, onSelect } = props;
  const { subjects, pages } = useNotes();
  const { pdfs } = usePdfs();
  const selection = parseSelection(selectedId);

  if (selection.kind === "other") return <PlaceholderView {...props} selectedId={selection.id} />;

  // Pfad über der Notiz, z. B. "Semester 7 › Steuern" (jeder Teil anklickbar).
  const breadcrumb = (folderId: string | null | undefined) => {
    const path = folderPath(subjects, folderId);
    return (
      <>
        <button className="breadcrumb-link" onClick={() => onSelect(null)}>
          Uni
        </button>
        {path.map((folder) => (
          <Fragment key={folder.id}>
            <span className="breadcrumb-separator">›</span>
            <button className="breadcrumb-link" onClick={() => onSelect(subjectSelection(folder.id))}>
              {folder.name || "Ohne Namen"}
            </button>
          </Fragment>
        ))}
      </>
    );
  };

  if (selection.kind === "page") {
    const page = pages.find((p) => p.id === selection.id);
    if (page) return <PageView page={page} breadcrumb={breadcrumb(page.subjectId)} />;
  }

  if (selection.kind === "pdf") {
    const pdf = pdfs.find((p) => p.id === selection.id);
    if (pdf) return <PdfViewer key={pdf.id} pdf={pdf} breadcrumb={breadcrumb(pdf.folderId)} />;
  }

  // Ordner-Übersicht: ausgewählter Ordner oder (nichts gewählt) die oberste Ebene mit allen Ordnern.
  const folder = selection.kind === "subject" ? (subjects.find((s) => s.id === selection.id) ?? null) : null;
  return (
    <FolderBrowser
      key={folder?.id ?? "root"}
      mode="uni"
      folder={folder}
      nav={{
        root: () => onSelect(null),
        folder: (id) => onSelect(subjectSelection(id)),
        page: (id) => onSelect(pageSelection(id)),
        pdf: (id) => onSelect(pdfSelection(id)),
      }}
    />
  );
}
