// Durchsichtige Zeichenschicht über der ganzen Seite.
// - Stift-Modus aus: man tippt ganz normal im Editor, die Zeichnungen sind nur sichtbar.
// - Stift-Modus an: Maus/Trackpad/Stift malen auf der Seite.
// Jeder Strich merkt sich den Textblock darüber und wandert mit, wenn sich der Text verschiebt.
// Außerdem liegen hier die frei platzierbaren Bilder (eingefügt mit ⌘V), die genauso mitwandern.
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";

import { usePaneFocused } from "../components/PaneContext";
import { usePinchZoom } from "../components/usePinchZoom";
import { savePageDrawing, savePageImages } from "../storage/db";
import { publish, useLiveSync } from "../storage/liveSync";
import { DrawingToolbar } from "./DrawingToolbar";
import { FloatingImages } from "./FloatingImages";
import { fileToDataUrl, initialImageSize, type FloatingImage } from "./images";
import { LassoOverlay } from "./LassoOverlay";
import { boundsOfPolygon, captureRegion, copySnipToClipboard } from "./snip";
import { PEN_COLORS, strokeToPath, type Stroke, type Tool } from "./strokes";
import { usePenShortcuts, useStrokeInput } from "./useStrokeInput";

type Props = {
  pageId: string;
  scrollRef: RefObject<HTMLDivElement | null>; // der scrollende Bereich der Seite
  initialStrokes: Stroke[];
  initialImages: FloatingImage[];
  // Titel + Editor. Darüber liegt die Zeichenschicht.
  children: ReactNode;
};

// Position eines Elements innerhalb eines umgebenden Elements – unabhängig von Zoom/Transform.
function offsetWithin(element: HTMLElement, ancestor: HTMLElement) {
  let top = 0;
  let left = 0;
  let current: HTMLElement | null = element;
  while (current && current !== ancestor) {
    top += current.offsetTop;
    left += current.offsetLeft;
    const parent = current.offsetParent as HTMLElement | null;
    // Liegt der Vorfahre nicht in der offsetParent-Kette, mit seinem eigenen Abstand ausgleichen.
    if (parent && !ancestor.contains(parent)) {
      top -= ancestor.offsetTop;
      left -= ancestor.offsetLeft;
      break;
    }
    current = parent;
  }
  return { top, left };
}

// Alles, was an einem Textblock hängt (Striche und Bilder).
type Anchored = { anchorBlockId: string | null; anchorTop: number };

type Layout = {
  columnLeft: number; // Abstand der Textspalte vom linken Rand
  blockTops: Record<string, number>; // Block-ID -> aktuelle Höhe auf der Seite
};

export function DrawingLayer({ pageId, scrollRef, initialStrokes, initialImages, children }: Props) {
  const textRef = useRef<HTMLDivElement>(null); // daraus lesen wir, wo die Textblöcke liegen
  const svgRef = useRef<SVGSVGElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // ---------- Zoom (nur das Blatt, nicht die ganze App) ----------
  // Das Blatt wird per "transform: scale" vergrößert, ohne dass sich der Zeilenumbruch ändert.
  // Alle Positionen (Striche, Bilder) bleiben in ungezoomten Einheiten gespeichert.
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const [viewport, setViewport] = useState({ width: 0, height: 0 }); // sichtbarer Bereich, ungezoomt
  const [contentHeight, setContentHeight] = useState(0);
  usePinchZoom({ scrollRef, contentRef: sizerRef, zoom, setZoom, min: 1, max: 6 });

  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    const observer = new ResizeObserver(() => {
      const paddingTop = parseFloat(getComputedStyle(scroller).paddingTop) || 0;
      setViewport({ width: scroller.clientWidth, height: scroller.clientHeight - paddingTop });
      setContentHeight(content.offsetHeight);
    });
    observer.observe(scroller);
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollRef]);
  const zoomed = zoom !== 1;
  const [strokes, setStrokes] = useState(initialStrokes);
  const [images, setImages] = useState(initialImages);
  const [layout, setLayout] = useState<Layout>({ columnLeft: 0, blockTops: {} });

  const [penMode, setPenMode] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(PEN_COLORS[0]);

  const [history, setHistory] = useState<Stroke[][]>([]); // frühere Stände für "Rückgängig"

  // ---------- Positionen der Textblöcke messen ----------
  useEffect(() => {
    const text = textRef.current;
    const svg = svgRef.current;
    if (!text || !svg) return;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Gemessen wird über das Layout (offsetTop), nicht über die Bildschirmposition –
        // so stimmt es auch beim Zoomen und während einer Zoom-Geste.
        const page = svg.parentElement!;
        const column = text.querySelector<HTMLElement>(".bn-container");
        const blockTops: Record<string, number> = {};
        text.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]").forEach((el) => {
          blockTops[el.dataset.id!] = offsetWithin(el, page).top;
        });
        setLayout({
          columnLeft: column ? offsetWithin(column, page).left : 0,
          blockTops,
        });
      });
    };

    // Neu messen, wenn sich der Text ändert oder das Fenster eine andere Größe bekommt.
    const mutations = new MutationObserver(measure);
    mutations.observe(text, { childList: true, subtree: true, characterData: true });
    const resizes = new ResizeObserver(measure);
    resizes.observe(text);
    measure();

    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resizes.disconnect();
    };
  }, []);

  // Wie weit ein Strich verschoben werden muss, weil sein Textblock gewandert ist.
  const offsetOf = (item: Anchored) => {
    const top = item.anchorBlockId ? layout.blockTops[item.anchorBlockId] : undefined;
    return top === undefined ? 0 : top - item.anchorTop;
  };

  // Ist dieselbe Seite im Split-Modus zweimal offen, gleichen sich beide live ab.
  const paneFocused = usePaneFocused();
  const strokesSyncId = useLiveSync<Stroke[]>(`page-drawing:${pageId}`, setStrokes);
  const imagesSyncId = useLiveSync<FloatingImage[]>(`page-images:${pageId}`, setImages);

  // ---------- Ändern + Speichern ----------
  const save = (next: Stroke[]) => {
    setStrokes(next);
    savePageDrawing(pageId, next);
    publish(`page-drawing:${pageId}`, strokesSyncId, next);
  };

  const commit = (next: Stroke[]) => {
    setHistory([...history, strokes]);
    save(next);
  };

  const undo = () => {
    if (history.length === 0) return;
    save(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  };

  usePenShortcuts(penMode, () => setPenMode(false), undo);

  // Anker suchen: der unterste Textblock, der oberhalb von "top" beginnt.
  const findAnchor = (top: number) => {
    let anchorBlockId: string | null = null;
    let anchorTop = 0;
    for (const [id, blockTop] of Object.entries(layout.blockTops)) {
      if (blockTop <= top && (anchorBlockId === null || blockTop >= anchorTop)) {
        anchorBlockId = id;
        anchorTop = blockTop;
      }
    }
    return { anchorBlockId, anchorTop };
  };

  // Strich an der Stelle festmachen, wo er gerade angezeigt wird (nach Zeichnen oder Verschieben).
  const anchorStroke = (stroke: Stroke): Stroke => {
    const dy = offsetOf(stroke);
    const points = stroke.points.map(([x, y, p]) => [x, y + dy, p] as [number, number, number]);
    const top = Math.min(...points.map(([, y]) => y));
    return { ...stroke, points, ...findAnchor(top) };
  };

  // ---------- Frei platzierte Bilder ----------
  // Jede Änderung baut auf dem neuesten Stand auf und wird sofort gespeichert.
  const updateImages = (change: (current: FloatingImage[]) => FloatingImage[]) =>
    setImages((current) => {
      const next = change(current);
      savePageImages(pageId, next);
      publish(`page-images:${pageId}`, imagesSyncId, next);
      return next;
    });

  // Bild an der Stelle festmachen, wo es gerade angezeigt wird.
  const anchorImage = (image: FloatingImage): FloatingImage => {
    const y = image.y + offsetOf(image);
    return { ...image, y, ...findAnchor(y) };
  };

  // Wo soll ein eingefügtes Bild hin? Unter die Zeile mit dem Text-Cursor, sonst oben in den sichtbaren Bereich.
  const pastePositionY = () => {
    const origin = svgRef.current!.getBoundingClientRect();
    const node = window.getSelection()?.anchorNode;
    const element = node instanceof Element ? node : node?.parentElement;
    const block = element?.closest(".bn-block-outer");
    const z = zoomRef.current;
    if (block && textRef.current?.contains(block)) {
      return (block.getBoundingClientRect().bottom - origin.top) / z + 8;
    }
    return Math.max(0, -origin.top / z + 120);
  };

  // ⌘V mit einem Bild (z. B. einem Ausschnitt) -> als frei verschiebbare Box einfügen.
  useEffect(() => {
    if (!paneFocused) return; // im Split-Modus nur die aktive Hälfte
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (!file) return; // normaler Text: macht der Editor selbst
      event.preventDefault();
      event.stopPropagation();
      const y = pastePositionY();
      // Nicht breiter als der Platz von der Textspalte bis zum rechten Rand (wichtig im Split-Modus).
      const availableWidth = svgRef.current!.clientWidth - layout.columnLeft - 24;
      (async () => {
        const src = await fileToDataUrl(file);
        const size = await initialImageSize(src, availableWidth);
        updateImages((current) => [
          ...current,
          { id: crypto.randomUUID(), src, x: 0, y, ...size, ...findAnchor(y) },
        ]);
      })();
    };
    // "capture": vor dem Editor reagieren, sonst fügt er das Bild fest in den Text ein.
    window.addEventListener("paste", onPaste, true);
    return () => window.removeEventListener("paste", onPaste, true);
  });

  // ---------- Zeichnen mit Maus / Trackpad / Stift ----------
  const { draft, draftPathRef, handlers, lasso, selection, selectionBox, deleteSelection, dragOffset } =
    useStrokeInput({
    enabled: penMode,
    surfaceRef: svgRef,
    tool,
    color,
    strokes,
    offsetOf,
    toPoint: (event) => {
      const origin = svgRef.current!.getBoundingClientRect();
      return [
        (event.clientX - origin.left) / zoom - layout.columnLeft,
        (event.clientY - origin.top) / zoom,
        event.pressure || 0.5,
      ];
    },
    onErase: save,
    onEraseDone: (before) => setHistory([...history, before]),
    onStrokeDone: (stroke) => commit([...strokes, anchorStroke(stroke)]),
    // Verschobene Striche hängen danach am Text an ihrer neuen Stelle.
    onMoveDone: (next, movedIds) =>
      commit(next.map((s) => (movedIds.has(s.id) ? anchorStroke(s) : s))),
    onDeleteSelection: commit,
    onSnip: (polygon) => {
      const box = boundsOfPolygon(polygon);
      const element = svgRef.current!.parentElement!; // die ganze Seite (Text + Zeichnungen)
      copySnipToClipboard(captureRegion(element, { ...box, x: box.x + layout.columnLeft }));
    },
  });

  // SVG-Formen nur neu berechnen, wenn sich die Striche ändern.
  const paths = useMemo(() => new Map(strokes.map((s) => [s.id, strokeToPath(s)])), [strokes]);

  const renderStroke = (stroke: Stroke, path: string, ref?: React.Ref<SVGPathElement>) => {
    const isSelected = selection.has(stroke.id);
    const dx = isSelected ? dragOffset.dx : 0;
    const dy = offsetOf(stroke) + (isSelected ? dragOffset.dy : 0);
    const classes = [stroke.tool === "highlighter" ? "highlighter-stroke" : "", isSelected ? "selected" : ""];
    return (
      <path
        key={stroke.id}
        ref={ref}
        d={path}
        fill={stroke.color}
        transform={`translate(${layout.columnLeft + dx} ${dy})`}
        className={classes.join(" ").trim() || undefined}
      />
    );
  };

  return (
    <>
      {/* Die Werkzeugleiste "klebt" oben rechts an der Seite, auch beim Scrollen – und zoomt nicht mit. */}
      <div className="toolbar-dock">
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
        />
      </div>

      {/* "sizer" hat die gezoomte Größe (damit man scrollen kann), darin das vergrößerte Blatt. */}
      <div
        className="zoom-sizer"
        ref={sizerRef}
        style={zoomed ? { width: viewport.width * zoom, height: contentHeight * zoom } : undefined}
      >
      <div
        className="page-content"
        ref={contentRef}
        style={{
          minHeight: viewport.height || undefined,
          ...(zoomed && { width: viewport.width, transform: `scale(${zoom})`, transformOrigin: "0 0" }),
        }}
      >
      <div className="page-text" ref={textRef}>
        {children}
      </div>

      <FloatingImages
        images={images}
        columnLeft={layout.columnLeft}
        zoom={zoom}
        offsetOf={offsetOf}
        interactive={!penMode}
        onMove={(id, dx, dy) =>
          updateImages((current) =>
            current.map((img) => (img.id === id ? anchorImage({ ...img, x: img.x + dx, y: img.y + dy }) : img)),
          )
        }
        onResize={(id, width, height) =>
          updateImages((current) => current.map((img) => (img.id === id ? { ...img, width, height } : img)))
        }
        onDelete={(id) => updateImages((current) => current.filter((img) => img.id !== id))}
      />

      <svg
        ref={svgRef}
        className={`drawing-layer ${penMode ? "active" : ""} tool-${tool}`}
        {...handlers}
      >
        {strokes.map((s) => renderStroke(s, paths.get(s.id) ?? ""))}
        {draft && renderStroke({ ...draft, anchorBlockId: null }, strokeToPath(draft), draftPathRef)}
        <g transform={`translate(${layout.columnLeft} 0)`}>
          <LassoOverlay lasso={lasso} box={selectionBox} onDelete={deleteSelection} />
        </g>
      </svg>
      </div>
      </div>
    </>
  );
}
