// Zweite Seitenleiste im Uni-Bereich: Fächer (aufklappbar, mit ihren Seiten) + Planung.
import { ChevronRight, FileText, Folder, Plus, X } from "lucide-react";

import { usePersistentState } from "../../storage/uiState";
import { pagesOfSubject, useNotes } from "../notes/NotesContext";
import type { SectionProps } from "../types";
import { pageSelection, parseSelection, subjectSelection } from "./selection";

export function UniPanel({ section, selectedId, onSelect }: SectionProps) {
  const { subjects, pages, createSubject, createPage, deletePage } = useNotes();
  // Welche Fächer aufgeklappt sind (Standard: aufgeklappt).
  const [collapsed, setCollapsed] = usePersistentState<Record<string, boolean>>("ui:uniCollapsed", {});
  const selection = parseSelection(selectedId);

  const isActive = (kind: string, id: string) =>
    selection.kind === kind && "id" in selection && selection.id === id;

  const toggle = (subjectId: string) => setCollapsed({ ...collapsed, [subjectId]: !collapsed[subjectId] });

  const addPage = (subjectId: string) => {
    setCollapsed({ ...collapsed, [subjectId]: false });
    onSelect(pageSelection(createPage(subjectId).id));
  };

  const removePage = (id: string, title: string, subjectId: string) => {
    if (!window.confirm(`Seite "${title || "Ohne Titel"}" wirklich löschen?`)) return;
    deletePage(id);
    if (isActive("page", id)) onSelect(subjectSelection(subjectId));
  };

  return (
    <>
      <nav className="panel-list">
        <div className="panel-section-title">Fächer</div>

        {subjects.length === 0 && <p className="panel-hint">Noch keine Fächer angelegt.</p>}

        {subjects.map((subject) => {
          const open = !collapsed[subject.id];
          return (
            <div key={subject.id}>
              <div
                className={`panel-item ${isActive("subject", subject.id) ? "active" : ""}`}
                onClick={() => onSelect(subjectSelection(subject.id))}
              >
                <button
                  className={`panel-chevron ${open ? "open" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(subject.id);
                  }}
                  title={open ? "Zuklappen" : "Aufklappen"}
                >
                  <ChevronRight size={14} />
                </button>
                <Folder size={15} className="panel-item-icon" />
                <span className="panel-item-label">{subject.name || "Ohne Namen"}</span>
                <button
                  className="panel-item-action"
                  title="Neue Seite in diesem Fach"
                  onClick={(e) => {
                    e.stopPropagation();
                    addPage(subject.id);
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>

              {open &&
                pagesOfSubject(pages, subject.id).map((page) => (
                  <div
                    key={page.id}
                    className={`panel-item nested ${isActive("page", page.id) ? "active" : ""}`}
                    onClick={() => onSelect(pageSelection(page.id))}
                  >
                    <FileText size={15} className="panel-item-icon" />
                    <span className="panel-item-label">{page.title || "Ohne Titel"}</span>
                    <button
                      className="panel-item-action"
                      title="Seite löschen"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePage(page.id, page.title, subject.id);
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
            </div>
          );
        })}

        <div className="panel-section-title">Planung</div>
        {(section.subItems ?? []).map((item) => (
          <button
            key={item.id}
            className={`panel-item ${isActive("other", item.id) ? "active" : ""}`}
            onClick={() => onSelect(item.id)}
          >
            {item.icon && <item.icon size={15} className="panel-item-icon" />}
            <span className="panel-item-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <button
        className="panel-add-button"
        onClick={() => onSelect(subjectSelection(createSubject().id))}
      >
        <Plus size={15} /> Neues Fach
      </button>
    </>
  );
}
