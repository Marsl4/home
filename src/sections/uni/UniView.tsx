// Hauptansicht im Uni-Bereich: Fach-Übersicht, eine Seite des Fachs oder ein Platzhalter.
import { FileText, GraduationCap, Plus } from "lucide-react";

import type { Subject } from "../../storage/db";
import { pagesOfSubject, useNotes } from "../notes/NotesContext";
import { PageView } from "../notes/PageView";
import { PlaceholderView } from "../placeholder/PlaceholderView";
import type { SectionProps } from "../types";
import { pageSelection, parseSelection, subjectSelection } from "./selection";

export function UniView(props: SectionProps) {
  const { selectedId, onSelect } = props;
  const { subjects, pages, createSubject } = useNotes();
  const selection = parseSelection(selectedId);

  if (selection.kind === "other") return <PlaceholderView {...props} selectedId={selection.id} />;

  if (selection.kind === "page") {
    const page = pages.find((p) => p.id === selection.id);
    const subject = subjects.find((s) => s.id === page?.subjectId);
    if (page && subject) {
      return (
        <PageView
          page={page}
          breadcrumb={
            <button className="breadcrumb-link" onClick={() => onSelect(subjectSelection(subject.id))}>
              {subject.name || "Ohne Namen"}
            </button>
          }
        />
      );
    }
  }

  // Ausgewähltes Fach, sonst das erste.
  const subject =
    (selection.kind === "subject" && subjects.find((s) => s.id === selection.id)) || subjects[0];

  if (!subject) {
    return (
      <div className="placeholder-view">
        <div className="placeholder-icon">
          <GraduationCap size={32} strokeWidth={1.5} />
        </div>
        <h1>Noch keine Fächer</h1>
        <p>Lege für jedes Fach einen Ordner an – mit eigenen Notizseiten.</p>
        <button
          className="primary-button"
          onClick={() => onSelect(subjectSelection(createSubject().id))}
        >
          <Plus size={16} /> Erstes Fach anlegen
        </button>
      </div>
    );
  }

  return <SubjectOverview key={subject.id} subject={subject} onSelect={onSelect} />;
}

// Übersicht eines Fachs: Name (umbenennbar), Liste der Seiten, neue Seite, Fach löschen.
function SubjectOverview({
  subject,
  onSelect,
}: {
  subject: Subject;
  onSelect: (id: string | null) => void;
}) {
  const { pages, createPage, renameSubject, deleteSubject } = useNotes();
  const subjectPages = pagesOfSubject(pages, subject.id);

  const handleDelete = () => {
    const name = subject.name || "Ohne Namen";
    const extra = subjectPages.length ? ` und seine ${subjectPages.length} Seite(n)` : "";
    if (!window.confirm(`Fach "${name}"${extra} wirklich löschen?`)) return;
    deleteSubject(subject.id);
    onSelect(null);
  };

  return (
    <div className="subject-overview">
      <input
        className="page-title-input"
        value={subject.name}
        placeholder="Name des Fachs"
        autoFocus={!subject.name}
        onChange={(e) => renameSubject(subject.id, e.target.value)}
      />

      <div className="subject-pages">
        {subjectPages.map((page) => (
          <button key={page.id} className="subject-page" onClick={() => onSelect(pageSelection(page.id))}>
            <FileText size={16} />
            <span>{page.title || "Ohne Titel"}</span>
          </button>
        ))}
        <button
          className="subject-page add"
          onClick={() => onSelect(pageSelection(createPage(subject.id).id))}
        >
          <Plus size={16} />
          <span>Neue Seite</span>
        </button>
      </div>

      <div className="subject-footer">
        <button className="text-button danger" onClick={handleDelete}>
          Fach löschen
        </button>
      </div>
    </div>
  );
}
