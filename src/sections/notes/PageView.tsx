// Zeigt EINE Notizseite: Titel, Editor und Zeichenschicht. Wird von Notizen und Uni benutzt.
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ScrollIndicator } from "../../components/ScrollIndicator";
import { DrawingLayer } from "../../drawing/DrawingLayer";
import type { FloatingImage } from "../../drawing/images";
import type { Stroke } from "../../drawing/strokes";
import type { FloatingText } from "../../drawing/texts";
import { removeUnknownBlocks, type EditorBlock } from "../../editor/schema";
import { readScrollSpot, restoreScrollTop, saveScrollSpot } from "../../storage/scrollMemory";
import { loadPageContent, loadPageDrawing, loadPageImages, loadPageTexts, type Page } from "../../storage/db";
import { useNotes } from "./NotesContext";
import { PageEditor } from "./PageEditor";

type LoadedPage = {
  pageId: string;
  blocks: EditorBlock[] | undefined;
  strokes: Stroke[];
  images: FloatingImage[];
  texts: FloatingText[];
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
      loadPageTexts(page.id),
    ]).then(([blocks, strokes, images, texts]) => {
      if (cancelled) return;
      setLoaded({
        pageId: page.id,
        blocks: blocks && removeUnknownBlocks(blocks as EditorBlock[]),
        strokes,
        images,
        texts,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [page.id]);

  // Beim Öffnen dorthin springen, wo man zuletzt war, und beim Scrollen die Stelle merken.
  const loadedId = loaded?.pageId === page.id ? page.id : null;
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !loadedId) return;
    const spot = readScrollSpot(loadedId);
    const restore = restoreScrollTop(scroller, () => (spot && "top" in spot ? spot.top : 0));
    let pending: number | null = null;
    let timer = 0;
    const flush = () => {
      if (pending !== null) saveScrollSpot(loadedId, { top: pending });
      pending = null;
    };
    const onScroll = () => {
      if (restore.running()) return;
      pending = scroller.scrollTop;
      clearTimeout(timer);
      timer = window.setTimeout(flush, 200);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      restore.cancel();
      scroller.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
      flush(); // beim Verlassen sofort speichern
    };
  }, [loadedId]);

  if (loaded?.pageId !== page.id) return null; // lädt noch

  return (
    // light-surface: das Schreibblatt bleibt auch im dunklen Design hell.
    <>
    <div className="page light-surface" ref={scrollRef}>
      {/* key: beim Seitenwechsel Editor und Zeichenschicht komplett neu aufbauen */}
      <DrawingLayer
        key={page.id}
        pageId={page.id}
        title={page.title}
        scrollRef={scrollRef}
        initialStrokes={loaded.strokes}
        initialImages={loaded.images}
        initialTexts={loaded.texts}
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
