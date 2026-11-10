// Zeigt ein PDF: Kopfzeile (Name, Favorit), alle Seiten untereinander, Stift-Werkzeuge.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PanelLeft, Share, Star } from "lucide-react";

import { ScrollIndicator } from "../../components/ScrollIndicator";
import { usePinchZoom } from "../../components/usePinchZoom";
import { DrawingToolbar } from "../../drawing/DrawingToolbar";
import { PEN_COLORS, type Stroke, type Tool } from "../../drawing/strokes";
import { eraserRadius, strokeSize, useToolSettings } from "../../drawing/toolSettings";
import { usePenShortcuts } from "../../drawing/useStrokeInput";
import { loadPdfFile, loadPdfInk, savePdfInk, type PdfDoc, type PdfInk } from "../../storage/db";
import { publish, useLiveSync } from "../../storage/liveSync";
import { usePersistentState } from "../../storage/uiState";
import { exportPdfFile } from "../../storage/exportFiles";
import { readScrollSpot, restoreScrollTop, saveScrollSpot } from "../../storage/scrollMemory";
import { getDocument, type PDFDocumentProxy } from "./pdfjs";
import { PdfPage } from "./PdfPage";
import { PdfSidebar } from "./PdfSidebar";
import { setPdfPosition, usePdfPosition } from "./visiblePage";
import { usePdfs } from "./PdfsContext";

const MAX_PAGE_WIDTH = 900;

type Loaded = {
  doc: PDFDocumentProxy;
  sizes: [number, number][]; // Größe jeder Seite in PDF-Einheiten
};

// breadcrumb: optional ein Pfad vor dem Namen (im Uni-Bereich: „Uni › 7. Semester ›“)
export function PdfViewer({ pdf, breadcrumb }: { pdf: PdfDoc; breadcrumb?: ReactNode }) {
  const { updatePdf } = usePdfs();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ink, setInk] = useState<PdfInk>({});
  const [history, setHistory] = useState<PdfInk[]>([]); // für "Rückgängig"

  const [penMode, setPenMode] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(PEN_COLORS[0]);
  const { settings: toolSettings, update: updateToolSettings } = useToolSettings();

  // Verfügbare Breite messen, damit die Seiten hineinpassen.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  useEffect(() => {
    const element = scrollRef.current!;
    const observer = new ResizeObserver(() => setAvailableWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // Zoom nur im PDF (zwei Finger / Trackpad). Die Seiten werden danach in der neuen Größe scharf gezeichnet.
  const pagesRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  usePinchZoom({ scrollRef, contentRef: pagesRef, zoom, setZoom, min: 0.5, max: 6 });
  const displayWidth = Math.min(availableWidth - 48, MAX_PAGE_WIDTH) * zoom;

  // Seitenleiste mit Miniaturen und Suche
  const [sidebarOpen, setSidebarOpen] = usePersistentState("ui:pdfSidebar", false);
  const [query, setQuery] = useState("");
  const position = usePdfPosition(pdf.id);
  const jumpTo = (pageIndex: number) => {
    const page = scrollRef.current?.querySelectorAll<HTMLElement>(".pdf-page")[pageIndex];
    if (page && scrollRef.current) scrollRef.current.scrollTop = page.offsetTop - 12;
  };

  // Beim Öffnen dorthin springen, wo man zuletzt war (einmal pro PDF, sobald die Seiten Platz haben).
  const restoreRef = useRef<{ pdfId: string; running: () => boolean; cancel: () => void } | null>(null);
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !loaded || displayWidth <= 0 || restoreRef.current?.pdfId === pdf.id) return;
    const spot = readScrollSpot(pdf.id);
    const restore = restoreScrollTop(scroller, () => {
      if (!spot || !("page" in spot)) return 0;
      const page = scroller.querySelectorAll<HTMLElement>(".pdf-page")[spot.page];
      return page ? page.offsetTop + spot.within * page.offsetHeight : null;
    });
    restoreRef.current = { pdfId: pdf.id, ...restore };
  }, [loaded, pdf.id, displayWidth]);
  useEffect(() => () => restoreRef.current?.cancel(), []);

  // Welche Seite ist gerade sichtbar? (für die KI-Leiste: "diese Seite mitschicken")
  // Beim Scrollen außerdem die Stelle merken (Seite + Anteil darin).
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !loaded) return;
    const update = () => {
      const probe = scroller.scrollTop + scroller.clientHeight / 3;
      const pages = Array.from(scroller.querySelectorAll<HTMLElement>(".pdf-page"));
      const index = pages.findIndex((el) => el.offsetTop + el.offsetHeight > probe);
      setPdfPosition(pdf.id, { page: (index === -1 ? pages.length - 1 : index) + 1, pageCount: loaded.sizes.length });
    };
    // Stelle beim Scrollen ausrechnen, aber erst kurz danach speichern (nicht bei jedem Pixel).
    let pending: { page: number; within: number } | null = null;
    let timer = 0;
    const flush = () => {
      if (pending) saveScrollSpot(pdf.id, pending);
      pending = null;
    };
    const onScroll = () => {
      update();
      if (restoreRef.current?.pdfId !== pdf.id || restoreRef.current.running()) return;
      const pages = Array.from(scroller.querySelectorAll<HTMLElement>(".pdf-page"));
      const index = Math.max(0, pages.findIndex((el) => el.offsetTop + el.offsetHeight > scroller.scrollTop));
      const page = pages[index];
      if (!page) return;
      pending = { page: index, within: Math.min(1, Math.max(0, (scroller.scrollTop - page.offsetTop) / page.offsetHeight)) };
      clearTimeout(timer);
      timer = window.setTimeout(flush, 200);
    };
    update();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
      flush(); // beim Verlassen sofort speichern
    };
  }, [loaded, pdf.id, displayWidth]);

  // PDF-Datei und Zeichnungen laden.
  useEffect(() => {
    let task: ReturnType<typeof getDocument> | null = null;
    let cancelled = false;

    (async () => {
      try {
        const [file, storedInk] = await Promise.all([loadPdfFile(pdf.id), loadPdfInk(pdf.id)]);
        if (!file) throw new Error("Datei nicht gefunden");
        task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
        const doc = await task.promise;
        const sizes = await Promise.all(
          Array.from({ length: doc.numPages }, async (_, i) => {
            const viewport = (await doc.getPage(i + 1)).getViewport({ scale: 1 });
            return [viewport.width, viewport.height] as [number, number];
          }),
        );
        if (cancelled) return;
        setInk(storedInk);
        setLoaded({ doc, sizes });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      task?.destroy(); // PDF schließen und Speicher freigeben
    };
  }, [pdf.id]);

  // ---------- Zeichnungen ändern + speichern ----------
  // Ist dieselbe PDF im Split-Modus zweimal offen, gleichen sich beide live ab.
  const inkSyncId = useLiveSync<PdfInk>(`pdf-ink:${pdf.id}`, setInk);

  const save = (next: PdfInk) => {
    setInk(next);
    savePdfInk(pdf.id, next);
    publish(`pdf-ink:${pdf.id}`, inkSyncId, next);
  };

  const withPage = (index: number, strokes: Stroke[]) => ({ ...ink, [index]: strokes });

  const undo = () => {
    if (history.length === 0) return;
    save(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  };

  usePenShortcuts(penMode, () => setPenMode(false), undo);

  return (
    <div className="pdf-viewer">
      <header className="pdf-header">
        <button
          className={`icon-button ${sidebarOpen ? "active" : ""}`}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? "Seitenleiste ausblenden" : "Seiten & Suche"}
        >
          <PanelLeft size={17} />
        </button>
        {breadcrumb && (
          <span className="pdf-breadcrumb">
            {breadcrumb}
            <span className="breadcrumb-separator">›</span>
          </span>
        )}
        <input
          className="pdf-name-input"
          value={pdf.name}
          onChange={(e) => updatePdf(pdf.id, { name: e.target.value })}
        />
        <button
          className={`icon-button ${pdf.favorite ? "favorite" : ""}`}
          onClick={() => updatePdf(pdf.id, { favorite: !pdf.favorite })}
          title={pdf.favorite ? "Aus Favoriten entfernen" : "Zu Favoriten"}
        >
          <Star size={18} fill={pdf.favorite ? "currentColor" : "none"} />
        </button>
        <button className="icon-button" onClick={() => exportPdfFile(pdf)} title="PDF exportieren (in „Downloads“ speichern)">
          <Share size={17} />
        </button>
        {loaded && <span className="pdf-page-count">{loaded.sizes.length} Seiten</span>}
      </header>

      <div className="pdf-body">
      {sidebarOpen && loaded && (
        <PdfSidebar
          doc={loaded.doc}
          sizes={loaded.sizes}
          currentPage={position?.page ?? 1}
          query={query}
          onQueryChange={setQuery}
          onJump={jumpTo}
        />
      )}
      <div className="pdf-scroll" ref={scrollRef}>
        {/* Abstände zoomen mit, damit die Stelle unter den Fingern beim Zoomen an ihrem Platz bleibt. */}
        <div className="pdf-pages" ref={pagesRef} style={{ gap: 16 * zoom, padding: `${24 * zoom}px ${24 * zoom}px 80px` }}>
        {error && <p className="pdf-error">PDF konnte nicht geöffnet werden: {error}</p>}
        {loaded &&
          displayWidth > 0 &&
          loaded.sizes.map((size, index) => (
            <PdfPage
              key={index}
              doc={loaded.doc}
              index={index}
              size={size}
              displayWidth={displayWidth}
              strokes={ink[index] ?? []}
              penMode={penMode}
              tool={tool}
              color={color}
              strokeSize={strokeSize(tool === "highlighter" ? "highlighter" : "pen", toolSettings)}
              eraserRadiusPx={eraserRadius(toolSettings)}
              eraserMode={toolSettings.eraserMode}
              highlight={sidebarOpen ? query : ""}
              onCommit={(strokes) => {
                setHistory([...history, ink]);
                save(withPage(index, strokes));
              }}
              onErase={(strokes) => save(withPage(index, strokes))}
              onEraseDone={(before) => setHistory([...history, withPage(index, before)])}
            />
          ))}
        </div>
      </div>
      </div>
      <ScrollIndicator scrollRef={scrollRef} />

      <DrawingToolbar
        penMode={penMode}
        onTogglePenMode={() => setPenMode(!penMode)}
        tool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={setColor}
        canUndo={history.length > 0}
        onUndo={undo}
        zoom={zoom}
        onResetZoom={() => setZoom(1)}
        settings={toolSettings}
        onSettingsChange={updateToolSettings}
      />
    </div>
  );
}
