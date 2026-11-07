// Hauptansicht im Notizen-Bereich: die geöffnete allgemeine Notizseite.
import { NotebookPen, Plus } from "lucide-react";

import type { SectionProps } from "../types";
import { generalPages, resolvePageId, useNotes } from "./NotesContext";
import { PageView } from "./PageView";

export function NotesView({ selectedId, onSelect }: SectionProps) {
  const { pages, createPage } = useNotes();
  const notes = generalPages(pages);
  const page = notes.find((p) => p.id === resolvePageId(notes, selectedId));

  if (!page) {
    return (
      <div className="placeholder-view">
        <div className="placeholder-icon">
          <NotebookPen size={32} strokeWidth={1.5} />
        </div>
        <h1>Noch keine Notiz da</h1>
        <p>Hier landen allgemeine Notizen. Fach-Notizen findest du unter Uni.</p>
        <button className="primary-button" onClick={() => onSelect(createPage().id)}>
          <Plus size={16} /> Erste Seite anlegen
        </button>
      </div>
    );
  }

  return <PageView page={page} />;
}
