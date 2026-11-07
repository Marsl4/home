// Hauptansicht im Uni-Bereich: Ordner-Übersicht, eine Notiz, ein PDF oder ein Platzhalter.
import { Fragment } from "react";
import { FileText, Folder, FolderInput, FolderPlus, GraduationCap, NotebookPen, Plus, Upload } from "lucide-react";

import type { Subject } from "../../storage/db";
import { useNotes } from "../notes/NotesContext";
import { PageView } from "../notes/PageView";
import { ImportPdfButton } from "../pdfs/ImportPdfButton";
import { usePdfs } from "../pdfs/PdfsContext";
import { PdfViewer } from "../pdfs/PdfViewer";
import { PlaceholderView } from "../placeholder/PlaceholderView";
import type { SectionProps } from "../types";
import { childFolders, folderPath } from "./folders";
import { useMoveDialog } from "./MoveDialog";
import { pageSelection, parseSelection, pdfSelection, subjectSelection } from "./selection";

export function UniView(props: SectionProps) {
  const { selectedId, onSelect } = props;
  const { subjects, pages, createSubject } = useNotes();
  const { pdfs } = usePdfs();
  const selection = parseSelection(selectedId);

  if (selection.kind === "other") return <PlaceholderView {...props} selectedId={selection.id} />;

  // Pfad über der Notiz, z. B. "Semester 7 › Steuern" (jeder Teil anklickbar).
  const breadcrumb = (folderId: string | null | undefined) => {
    const path = folderPath(subjects, folderId);
    if (path.length === 0) return undefined;
    return (
      <>
        {path.map((folder, i) => (
          <Fragment key={folder.id}>
            {i > 0 && <span className="breadcrumb-separator">›</span>}
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
    if (pdf) return <PdfViewer key={pdf.id} pdf={pdf} />;
  }

  // Ausgewählter Ordner, sonst der erste oberste.
  const folder =
    (selection.kind === "subject" && subjects.find((s) => s.id === selection.id)) || childFolders(subjects, null)[0];

  if (!folder) {
    return (
      <div className="placeholder-view">
        <div className="placeholder-icon">
          <GraduationCap size={32} strokeWidth={1.5} />
        </div>
        <h1>Noch keine Ordner</h1>
        <p>Lege Ordner an (z. B. „Semester 7“ → „Steuern“) – mit Notizen und PDFs darin.</p>
        <button className="primary-button" onClick={() => onSelect(subjectSelection(createSubject().id))}>
          <Plus size={16} /> Ersten Ordner anlegen
        </button>
      </div>
    );
  }

  return <FolderOverview key={folder.id} folder={folder} breadcrumb={breadcrumb(folder.parentId)} onSelect={onSelect} />;
}

// Übersicht eines Ordners: Name (umbenennbar), Unterordner, Notizen, PDFs und Aktionen.
function FolderOverview({
  folder,
  breadcrumb,
  onSelect,
}: {
  folder: Subject;
  breadcrumb: React.ReactNode;
  onSelect: (id: string | null) => void;
}) {
  const { subjects, pages, createPage, createSubject, renameSubject, deleteSubject } = useNotes();
  const { pdfs, updatePdf, deletePdf } = usePdfs();
  const [openMove, moveDialog] = useMoveDialog();
  const subfolders = childFolders(subjects, folder.id);
  const folderPages = pages.filter((p) => p.subjectId === folder.id);
  const folderPdfs = pdfs.filter((p) => p.folderId === folder.id);

  const openPdf = (id: string) => {
    updatePdf(id, { lastOpenedAt: Date.now() });
    onSelect(pdfSelection(id));
  };

  const handleDelete = () => {
    const name = folder.name || "Ohne Namen";
    if (!window.confirm(`Ordner "${name}" mit allen Unterordnern, Notizen und PDFs darin wirklich löschen?`)) return;
    const removed = deleteSubject(folder.id);
    pdfs.filter((p) => p.folderId && removed.has(p.folderId)).forEach((p) => deletePdf(p.id));
    onSelect(folder.parentId ? subjectSelection(folder.parentId) : null);
  };

  const empty = subfolders.length + folderPages.length + folderPdfs.length === 0;

  return (
    <div className="subject-overview">
      {breadcrumb && <div className="page-breadcrumb">{breadcrumb}</div>}
      <input
        className="page-title-input"
        value={folder.name}
        placeholder="Name des Ordners"
        autoFocus={!folder.name}
        onChange={(e) => renameSubject(folder.id, e.target.value)}
      />

      <div className="folder-actions">
        <button className="secondary-button" onClick={() => onSelect(pageSelection(createPage(folder.id).id))}>
          <NotebookPen size={15} /> Neue Notiz
        </button>
        <button className="secondary-button" onClick={() => onSelect(subjectSelection(createSubject(folder.id).id))}>
          <FolderPlus size={15} /> Unterordner
        </button>
        <ImportPdfButton className="secondary-button" folderId={folder.id} onImported={(added) => added[0] && openPdf(added[0].id)}>
          <Upload size={15} /> PDF importieren
        </ImportPdfButton>
      </div>

      {empty && <p className="panel-hint">Dieser Ordner ist noch leer.</p>}

      <div className="subject-pages">
        {subfolders.map((sub) => (
          <ItemCard key={sub.id} icon={<Folder size={16} />} label={sub.name || "Ohne Namen"} onOpen={() => onSelect(subjectSelection(sub.id))}
            onMove={() => openMove({ kind: "folder", id: sub.id, name: sub.name, parentId: sub.parentId ?? null })} />
        ))}
        {folderPages.map((page) => (
          <ItemCard key={page.id} icon={<NotebookPen size={16} />} label={page.title || "Ohne Titel"} onOpen={() => onSelect(pageSelection(page.id))}
            onMove={() => openMove({ kind: "page", id: page.id, name: page.title, parentId: page.subjectId ?? null })} />
        ))}
        {folderPdfs.map((pdf) => (
          <ItemCard key={pdf.id} icon={<FileText size={16} className="pdf-icon" />} label={pdf.name || "Ohne Namen"} onOpen={() => openPdf(pdf.id)}
            onMove={() => openMove({ kind: "pdf", id: pdf.id, name: pdf.name, parentId: pdf.folderId ?? null })} />
        ))}
      </div>

      <div className="subject-footer">
        <button
          className="text-button"
          onClick={() => openMove({ kind: "folder", id: folder.id, name: folder.name, parentId: folder.parentId ?? null })}
        >
          <FolderInput size={14} /> Ordner verschieben
        </button>
        <button className="text-button danger" onClick={handleDelete}>
          Ordner löschen
        </button>
      </div>
      {moveDialog}
    </div>
  );
}

function ItemCard({ icon, label, onOpen, onMove }: { icon: React.ReactNode; label: string; onOpen: () => void; onMove: () => void }) {
  return (
    <div className="subject-page" onClick={onOpen} role="button">
      {icon}
      <span>{label}</span>
      <button
        className="subject-page-move"
        title="Verschieben"
        onClick={(e) => {
          e.stopPropagation();
          onMove();
        }}
      >
        <FolderInput size={14} />
      </button>
    </div>
  );
}
