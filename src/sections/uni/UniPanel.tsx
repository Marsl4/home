// Zweite Seitenleiste im Uni-Bereich: Ordnerbaum (mit Notizen und PDFs) + Planung.
import { Plus } from "lucide-react";

import { useNotes } from "../notes/NotesContext";
import { usePdfs } from "../pdfs/PdfsContext";
import type { SectionProps } from "../types";
import { FolderTree } from "./FolderTree";
import { useMoveDialog } from "./MoveDialog";
import { pageSelection, parseSelection, pdfSelection, subjectSelection } from "./selection";

export function UniPanel({ section, selectedId, onSelect }: SectionProps) {
  const { subjects, pages, createSubject, createPage, deletePage } = useNotes();
  const { pdfs, updatePdf, deletePdf } = usePdfs();
  const [openMove, moveDialog] = useMoveDialog();
  const selection = parseSelection(selectedId);
  const activeId = "id" in selection ? selection.id : null;

  const openPdf = (id: string) => {
    updatePdf(id, { lastOpenedAt: Date.now() });
    onSelect(pdfSelection(id));
  };

  return (
    <>
      <nav className="panel-list">
        <div className="panel-section-title">Ordner</div>
        {subjects.length === 0 && (
          <p className="panel-hint">Noch keine Ordner. Lege z. B. „Semester 7“ an und darin deine Fächer.</p>
        )}

        <FolderTree
          mode="uni"
          folders={subjects}
          pages={pages}
          pdfs={pdfs}
          activeId={activeId}
          onOpenFolder={(id) => onSelect(subjectSelection(id))}
          onOpenPage={(id) => onSelect(pageSelection(id))}
          onOpenPdf={openPdf}
          onNewPage={(folderId) => onSelect(pageSelection(createPage(folderId).id))}
          onImported={(added) => added[0] && openPdf(added[0].id)}
          onMove={openMove}
          onDeletePage={(page) => {
            if (!window.confirm(`Notiz "${page.title || "Ohne Titel"}" wirklich löschen?`)) return;
            deletePage(page.id);
            if (activeId === page.id) onSelect(page.subjectId ? subjectSelection(page.subjectId) : null);
          }}
          onDeletePdf={(pdf) => {
            if (!window.confirm(`PDF "${pdf.name}" samt Notizen darauf wirklich löschen?`)) return;
            deletePdf(pdf.id);
            if (activeId === pdf.id) onSelect(pdf.folderId ? subjectSelection(pdf.folderId) : null);
          }}
        />

        <div className="panel-section-title">Planung</div>
        {(section.subItems ?? []).map((item) => (
          <button
            key={item.id}
            className={`panel-item ${selection.kind === "other" && selection.id === item.id ? "active" : ""}`}
            onClick={() => onSelect(item.id)}
          >
            {item.icon && <item.icon size={15} className="panel-item-icon" />}
            <span className="panel-item-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <button className="panel-add-button" onClick={() => onSelect(subjectSelection(createSubject().id))}>
        <Plus size={15} /> Neuer Ordner
      </button>
      {moveDialog}
    </>
  );
}
