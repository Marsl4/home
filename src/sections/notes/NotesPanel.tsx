// Zweite Seitenleiste im Notizen-Bereich: Liste aller Seiten.
import { FileText, Plus, X } from "lucide-react";

import type { SectionProps } from "../types";
import { generalPages, resolvePageId, useNotes } from "./NotesContext";

export function NotesPanel({ selectedId, onSelect }: SectionProps) {
  const { pages: allPages, createPage, deletePage } = useNotes();
  const pages = generalPages(allPages); // nur Seiten ohne Fach
  const activeId = resolvePageId(pages, selectedId);

  const handleDelete = (id: string, title: string) => {
    if (!window.confirm(`Seite "${title || "Ohne Titel"}" wirklich löschen?`)) return;
    const remaining = generalPages(deletePage(id));
    if (id === activeId) onSelect(remaining[0]?.id ?? null);
  };

  return (
    <>
      <nav className="panel-list">
        {pages.map((page) => (
          <div
            key={page.id}
            className={`panel-item ${page.id === activeId ? "active" : ""}`}
            onClick={() => onSelect(page.id)}
          >
            <FileText size={15} className="panel-item-icon" />
            <span className="panel-item-label">{page.title || "Ohne Titel"}</span>
            <button
              className="panel-item-action"
              title="Seite löschen"
              onClick={(event) => {
                event.stopPropagation(); // sonst wird die Seite gleichzeitig ausgewählt
                handleDelete(page.id, page.title);
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </nav>

      <button className="panel-add-button" onClick={() => onSelect(createPage().id)}>
        <Plus size={15} /> Neue Seite
      </button>
    </>
  );
}
