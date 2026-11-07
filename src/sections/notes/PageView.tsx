// Zeigt EINE Notizseite: Titel, Editor und Zeichenschicht. Wird von Notizen und Uni benutzt.
import { useEffect, useState, type ReactNode } from "react";

import { DrawingLayer } from "../../drawing/DrawingLayer";
import type { Stroke } from "../../drawing/strokes";
import { removeUnknownBlocks, type EditorBlock } from "../../editor/schema";
import { loadPageContent, loadPageDrawing, type Page } from "../../storage/db";
import { useNotes } from "./NotesContext";
import { PageEditor } from "./PageEditor";

type LoadedPage = {
  pageId: string;
  blocks: EditorBlock[] | undefined;
  strokes: Stroke[];
};

type Props = {
  page: Page;
  breadcrumb?: ReactNode; // optional: kleine Zeile über dem Titel, z. B. das Fach
};

export function PageView({ page, breadcrumb }: Props) {
  const { renamePage } = useNotes();
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);

  // Text und Zeichnungen der Seite laden.
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPageContent(page.id), loadPageDrawing(page.id)]).then(([blocks, strokes]) => {
      if (cancelled) return;
      setLoaded({
        pageId: page.id,
        blocks: blocks && removeUnknownBlocks(blocks as EditorBlock[]),
        strokes,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [page.id]);

  if (loaded?.pageId !== page.id) return null; // lädt noch

  return (
    // light-surface: das Schreibblatt bleibt auch im dunklen Design hell.
    <div className="page light-surface">
      {/* key: beim Seitenwechsel Editor und Zeichenschicht komplett neu aufbauen */}
      <DrawingLayer key={page.id} pageId={page.id} initialStrokes={loaded.strokes}>
        {breadcrumb && <div className="page-breadcrumb">{breadcrumb}</div>}
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
