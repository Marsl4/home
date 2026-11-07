// Zeigt EINE Notizseite: Titel, Editor und Zeichenschicht. Wird von Notizen und Uni benutzt.
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ScrollIndicator } from "../../components/ScrollIndicator";
import { DrawingLayer } from "../../drawing/DrawingLayer";
import type { FloatingImage } from "../../drawing/images";
import type { Stroke } from "../../drawing/strokes";
import { removeUnknownBlocks, type EditorBlock } from "../../editor/schema";
import { loadPageContent, loadPageDrawing, loadPageImages, type Page } from "../../storage/db";
import { useNotes } from "./NotesContext";
import { PageEditor } from "./PageEditor";

type LoadedPage = {
  pageId: string;
  blocks: EditorBlock[] | undefined;
  strokes: Stroke[];
  images: FloatingImage[];
};

type Props = {
  page: Page;
  breadcrumb?: ReactNode; // optional: kleine Zeile über dem Titel, z. B. das Fach
};

export function PageView({ page, breadcrumb }: Props) {
  const { renamePage } = useNotes();
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null); // der scrollende Bereich (für den Zoom)

  // Text und Zeichnungen der Seite laden.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadPageContent(page.id),
      loadPageDrawing(page.id),
      loadPageImages(page.id),
    ]).then(([blocks, strokes, images]) => {
      if (cancelled) return;
      setLoaded({
        pageId: page.id,
        blocks: blocks && removeUnknownBlocks(blocks as EditorBlock[]),
        strokes,
        images,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [page.id]);

  if (loaded?.pageId !== page.id) return null; // lädt noch

  return (
    // light-surface: das Schreibblatt bleibt auch im dunklen Design hell.
    <>
    <div className="page light-surface" ref={scrollRef}>
      {/* key: beim Seitenwechsel Editor und Zeichenschicht komplett neu aufbauen */}
      <DrawingLayer
        key={page.id}
        pageId={page.id}
        scrollRef={scrollRef}
        initialStrokes={loaded.strokes}
        initialImages={loaded.images}
      >
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
    <ScrollIndicator key={page.id} scrollRef={scrollRef} />
    </>
  );
}
