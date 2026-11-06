import type { Page } from "../storage/db";

type Props = {
  pages: Page[];
  activePageId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
};

export function Sidebar({ pages, activePageId, onSelect, onCreate, onDelete }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">Meine Seiten</div>

      <nav className="page-list">
        {pages.map((page) => (
          <div
            key={page.id}
            className={`page-item ${page.id === activePageId ? "active" : ""}`}
            onClick={() => onSelect(page.id)}
          >
            <span className="page-title">{page.title || "Ohne Titel"}</span>
            <button
              className="icon-button"
              title="Seite löschen"
              onClick={(event) => {
                event.stopPropagation(); // sonst wird die Seite gleichzeitig ausgewählt
                onDelete(page.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </nav>

      <button className="new-page-button" onClick={onCreate}>
        + Neue Seite
      </button>
    </aside>
  );
}
