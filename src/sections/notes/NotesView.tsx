// Hauptansicht im Notizen-Bereich: Titel, Editor und Zeichenschicht der offenen Seite.
import { useEffect, useState } from "react";
import { NotebookPen, Plus } from "lucide-react";

import { DrawingLayer } from "../../drawing/DrawingLayer";
import type { Stroke } from "../../drawing/strokes";
import { removeUnknownBlocks, type EditorBlock } from "../../editor/schema";
import { loadPageContent, loadPageDrawing } from "../../storage/db";
import type { SectionProps } from "../types";
import { resolvePageId, useNotes } from "./NotesContext";
import { PageEditor } from "./PageEditor";

type LoadedPage = {
  pageId: string;
  blocks: EditorBlock[] | undefined;
  strokes: Stroke[];
};

export function NotesView({ selectedId, onSelect }: SectionProps) {
  const { pages, createPage, renamePage } = useNotes();
  const pageId = resolvePageId(pages, selectedId);
  const page = pages.find((p) => p.id === pageId);
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);

  // Wenn eine andere Seite geöffnet wird: deren Text und Zeichnungen laden.
  useEffect(() => {
    if (!pageId) return;
    let cancelled = false;
    Promise.all([loadPageContent(pageId), loadPageDrawing(pageId)]).then(([blocks, strokes]) => {
      if (cancelled) return;
      setLoaded({ pageId, blocks: blocks && removeUnknownBlocks(blocks as EditorBlock[]), strokes });
    });
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  if (!page) {
    return (
      <div className="placeholder-view">
        <div className="placeholder-icon">
          <NotebookPen size={32} strokeWidth={1.5} />
        </div>
        <h1>Noch keine Seite da</h1>
        <button className="primary-button" onClick={() => onSelect(createPage().id)}>
          <Plus size={16} /> Erste Seite anlegen
        </button>
      </div>
    );
  }

  if (loaded?.pageId !== page.id) return null; // lädt noch

  return (
    <div className="page">
      {/* key: beim Seitenwechsel Editor und Zeichenschicht komplett neu aufbauen */}
      <DrawingLayer key={page.id} pageId={page.id} initialStrokes={loaded.strokes}>
        <input
          className="page-title-input"
          value={page.title}
          placeholder="Ohne Titel"
          onChange={(e) => renamePage(page.id, e.target.value)}
        />
        <PageEditor pageId={page.id} initialContent={loaded.blocks} />
      </DrawingLayer>
    </div>
  );
}
