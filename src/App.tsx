import { useEffect, useState } from "react";

import { Sidebar } from "./components/Sidebar";
import { PageEditor } from "./components/PageEditor";
import type { EditorBlock } from "./editor/schema";
import {
  deletePageContent,
  loadPageContent,
  loadPages,
  savePages,
  type Page,
} from "./storage/db";

export default function App() {
  const [pages, setPages] = useState<Page[] | null>(null); // null = lädt noch
  const [activePageId, setActivePageId] = useState<string | null>(null);
  // Inhalt der aktiven Seite, wie er aus dem Speicher geladen wurde.
  const [loadedContent, setLoadedContent] = useState<{
    pageId: string;
    blocks: EditorBlock[] | undefined;
  } | null>(null);

  // Beim Start: Seitenliste laden.
  useEffect(() => {
    loadPages().then((stored) => {
      setPages(stored);
      setActivePageId(stored[0]?.id ?? null);
    });
  }, []);

  // Wenn eine andere Seite ausgewählt wird: deren Inhalt laden.
  useEffect(() => {
    if (!activePageId) return;
    let cancelled = false;
    loadPageContent(activePageId).then((blocks) => {
      if (!cancelled) setLoadedContent({ pageId: activePageId, blocks: blocks as EditorBlock[] });
    });
    return () => {
      cancelled = true;
    };
  }, [activePageId]);

  // Seitenliste ändern = sofort speichern.
  const updatePages = (next: Page[]) => {
    setPages(next);
    savePages(next);
  };

  const createPage = () => {
    const page: Page = { id: crypto.randomUUID(), title: "" };
    updatePages([...(pages ?? []), page]);
    setActivePageId(page.id);
  };

  const renamePage = (id: string, title: string) => {
    updatePages((pages ?? []).map((p) => (p.id === id ? { ...p, title } : p)));
  };

  const deletePage = (id: string) => {
    const page = pages?.find((p) => p.id === id);
    if (!window.confirm(`Seite "${page?.title || "Ohne Titel"}" wirklich löschen?`)) return;

    const remaining = (pages ?? []).filter((p) => p.id !== id);
    updatePages(remaining);
    deletePageContent(id);
    if (activePageId === id) setActivePageId(remaining[0]?.id ?? null);
  };

  if (pages === null) return null; // kurz beim Laden

  const activePage = pages.find((p) => p.id === activePageId);

  return (
    <div className="app">
      <Sidebar
        pages={pages}
        activePageId={activePageId}
        onSelect={setActivePageId}
        onCreate={createPage}
        onDelete={deletePage}
      />

      <main className="page">
        {activePage ? (
          <>
            <input
              className="page-title-input"
              value={activePage.title}
              placeholder="Ohne Titel"
              onChange={(e) => renamePage(activePage.id, e.target.value)}
            />
            {loadedContent?.pageId === activePage.id && (
              <PageEditor
                key={activePage.id}
                pageId={activePage.id}
                initialContent={loadedContent.blocks}
              />
            )}
          </>
        ) : (
          <div className="empty-state">
            <p>Noch keine Seite da.</p>
            <button className="new-page-button" onClick={createPage}>
              + Erste Seite anlegen
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
