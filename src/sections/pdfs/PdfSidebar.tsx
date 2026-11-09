// Seitenleiste im PDF: Suchfeld + Miniaturen aller Seiten. Antippen = zur Seite springen.
// Bei einer Suche erscheint statt der Miniaturen die Trefferliste (mit Textausschnitt).
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { RenderingCancelledException, type PDFDocumentProxy } from "./pdfjs";
import { searchPdf, type SearchHit } from "./pdfSearch";

const THUMB_WIDTH = 112;

type Props = {
  doc: PDFDocumentProxy;
  sizes: [number, number][];
  currentPage: number; // ab 1
  query: string;
  onQueryChange: (query: string) => void;
  onJump: (pageIndex: number) => void; // ab 0
};

export function PdfSidebar({ doc, sizes, currentPage, query, onQueryChange, onJump }: Props) {
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Suchen (kurz nach dem letzten Tastendruck).
  useEffect(() => {
    const q = query.trim();
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (q.length < 2) {
        setHits(null);
        return;
      }
      setSearching(true);
      const result = await searchPdf(doc, q);
      if (!cancelled) {
        setHits(result);
        setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [doc, query]);

  // Die aktuelle Seite in der Miniaturen-Liste sichtbar halten.
  useEffect(() => {
    if (hits) return;
    const thumb = listRef.current?.querySelector<HTMLElement>(`[data-page="${currentPage - 1}"]`);
    thumb?.scrollIntoView({ block: "nearest" });
  }, [currentPage, hits]);

  return (
    <aside className="pdf-sidebar">
      <div className="pdf-search">
        <Search size={14} />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Im PDF suchen …"
          onKeyDown={(e) => {
            if (e.key === "Escape") onQueryChange("");
            if (e.key === "Enter" && hits?.[0]) onJump(hits[0].page);
          }}
        />
        {query && (
          <button className="icon-button" onClick={() => onQueryChange("")} title="Suche löschen">
            <X size={13} />
          </button>
        )}
      </div>

      <div className="pdf-sidebar-list" ref={listRef}>
        {hits ? (
          <>
            <p className="pdf-hit-count">
              {searching ? "Suche …" : hits.length ? `${hits.length >= 300 ? "300+" : hits.length} Treffer` : "Keine Treffer"}
            </p>
            {hits.map((hit, i) => (
              <button key={i} className={`pdf-hit ${hit.page === currentPage - 1 ? "current" : ""}`} onClick={() => onJump(hit.page)}>
                <span className="pdf-hit-page">S. {hit.page + 1}</span>
                <span className="pdf-hit-text">
                  {hit.snippet.before}
                  <mark>{hit.snippet.match}</mark>
                  {hit.snippet.after}
                </span>
              </button>
            ))}
          </>
        ) : (
          sizes.map((size, index) => (
            <Thumbnail key={index} doc={doc} index={index} size={size} active={index === currentPage - 1} onClick={() => onJump(index)} />
          ))
        )}
      </div>
    </aside>
  );
}

// Eine kleine Seitenvorschau – wird erst gezeichnet, wenn sie in der Leiste sichtbar wird.
function Thumbnail({ doc, index, size, active, onClick }: { doc: PDFDocumentProxy; index: number; size: [number, number]; active: boolean; onClick: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const height = Math.round((THUMB_WIDTH * size[1]) / size[0]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), {
      root: canvas.closest(".pdf-sidebar-list"),
      rootMargin: "400px 0px",
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    let cancelled = false;
    doc.getPage(index + 1).then((page) => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale: (THUMB_WIDTH / size[0]) * Math.min(2, window.devicePixelRatio) });
      const canvas = canvasRef.current!;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvas, viewport });
      task.promise.catch((error) => {
        if (!(error instanceof RenderingCancelledException)) console.error(error);
      });
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, doc, index, size]);

  return (
    <button className={`pdf-thumb ${active ? "active" : ""}`} data-page={index} onClick={onClick} title={`Seite ${index + 1}`}>
      <canvas ref={canvasRef} style={{ width: THUMB_WIDTH, height }} />
      <span>{index + 1}</span>
    </button>
  );
}
