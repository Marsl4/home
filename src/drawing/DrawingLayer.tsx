// Durchsichtige Zeichenschicht über der ganzen Seite.
// - Stift-Modus aus: man tippt ganz normal im Editor, die Zeichnungen sind nur sichtbar.
// - Stift-Modus an: Maus/Trackpad/Stift malen auf der Seite.
// Jeder Strich merkt sich den Textblock darüber und wandert mit, wenn sich der Text verschiebt.
// Außerdem liegen hier die frei platzierbaren Bilder (eingefügt mit ⌘V), die genauso mitwandern.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { flushSync } from "react-dom";

import { usePaneFocused } from "../components/PaneContext";
import { usePinchZoom } from "../components/usePinchZoom";
import { savePageDrawing, savePageImages, savePageTexts } from "../storage/db";
import { publish, useLiveSync } from "../storage/liveSync";
import { DrawingToolbar } from "./DrawingToolbar";
import { FloatingImages } from "./FloatingImages";
import { FloatingTexts } from "./FloatingTexts";
import { fileToDataUrl, initialImageSize, type FloatingImage } from "./images";
import { LassoOverlay } from "./LassoOverlay";
import { boundsOfPolygon, captureRegion, copySnipToClipboard } from "./snip";
import { PEN_COLORS, strokeToPath, type Stroke, type Tool } from "./strokes";
import { DEFAULT_TEXT_WIDTH, type FloatingText } from "./texts";
import { eraserRadius, strokeSize, useToolSettings } from "./toolSettings";
import { usePenShortcuts, useStrokeInput } from "./useStrokeInput";

type Props = {
  pageId: string;
  scrollRef: RefObject<HTMLDivElement | null>; // der scrollende Bereich der Seite
  initialStrokes: Stroke[];
  initialImages: FloatingImage[];
  initialTexts: FloatingText[];
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

export function DrawingLayer({ pageId, scrollRef, initialStrokes, initialImages, initialTexts, children }: Props) {
  const textRef = useRef<HTMLDivElement>(null); // daraus lesen wir, wo die Textblöcke liegen
  const svgRef = useRef<SVGSVGElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // ---------- Zoom (nur das Blatt, nicht die ganze App) ----------
  // Das Blatt wird per "transform: scale" vergrößert, ohne dass sich der Zeilenumbruch ändert.
  // Alle Positionen (Striche, Bilder) bleiben in ungezoomten Einheiten gespeichert.
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom); // aktueller Zoom für Ereignis-Funktionen
  useLayoutEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
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

  // ---------- Unendliches Blatt ----------
  // Unter dem Text bzw. der tiefsten Zeichnung ist immer mindestens eine Bildschirmhöhe Platz.
  // Scrollt man ans Ende, wächst das Blatt um eine weitere Bildschirmhöhe.
  const [extraHeight, setExtraHeight] = useState(0);
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onScroll = () => {
      const remaining = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      if (remaining < scroller.clientHeight / 2) setExtraHeight((h) => h + scroller.clientHeight / zoomRef.current);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [scrollRef]);
  const [strokes, setStrokes] = useState(initialStrokes);
  const [images, setImages] = useState(initialImages);
  const [texts, setTexts] = useState(initialTexts);
  const [textHeights, setTextHeights] = useState<Record<string, number>>({}); // gemessen, fürs Lasso
  const [layout, setLayout] = useState<Layout>({ columnLeft: 0, blockTops: {} });

  const [penMode, setPenMode] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(PEN_COLORS[0]);
  const { settings: toolSettings, update: updateToolSettings } = useToolSettings();

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
  const textsSyncId = useLiveSync<FloatingText[]>(`page-texts:${pageId}`, setTexts);

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

  // ---------- Frei platzierte Textfelder ----------
  const updateTexts = (change: (current: FloatingText[]) => FloatingText[]) =>
    setTexts((current) => {
      const next = change(current);
      savePageTexts(pageId, next);
      publish(`page-texts:${pageId}`, textsSyncId, next);
      return next;
    });

  const anchorText = (text: FloatingText): FloatingText => {
    const y = text.y + offsetOf(text);
    return { ...text, y, ...findAnchor(y) };
  };

  // Text-Werkzeug: neues Textfeld an der angetippten Stelle und sofort hineinschreiben.
  const placeText = (x: number, y: number) => {
    const id = crypto.randomUUID();
    const top = y - 12; // Zeile ungefähr mittig auf die Tipp-Stelle
    flushSync(() =>
      updateTexts((current) => [
        ...current,
        { id, text: "", x, y: top, width: DEFAULT_TEXT_WIDTH, ...findAnchor(top) },
      ]),
    );
    // direkt (noch im Tipp-Ereignis) fokussieren, sonst öffnet das iPad die Tastatur nicht
    document.querySelector<HTMLTextAreaElement>(`[data-text-id="${id}"]`)?.focus({ preventScroll: true });
  };

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
  const { draft, draftPathRef, eraser, handlers, lasso, selection, selectionBox, deleteSelection, dragOffset } =
    useStrokeInput({
    enabled: penMode,
    size: strokeSize(tool === "highlighter" ? "highlighter" : "pen", toolSettings),
    eraserRadius: eraserRadius(toolSettings) / zoom, // gleich groß auf dem Bildschirm, auch gezoomt
    eraserMode: toolSettings.eraserMode,
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
    onMoveDone: (next, movedIds, dx, dy) => {
      commit(next.map((s) => (movedIds.has(s.id) ? anchorStroke(s) : s)));
      if (texts.some((t) => movedIds.has(t.id))) {
        updateTexts((current) =>
          current.map((t) => (movedIds.has(t.id) ? anchorText({ ...t, x: t.x + dx, y: t.y + dy }) : t)),
        );
      }
      if (images.some((img) => movedIds.has(img.id))) {
        updateImages((current) =>
          current.map((img) => (movedIds.has(img.id) ? anchorImage({ ...img, x: img.x + dx, y: img.y + dy }) : img)),
        );
      }
    },
    onDeleteSelection: (next, selectedIds) => {
      commit(next);
      if (texts.some((t) => selectedIds.has(t.id))) {
        updateTexts((current) => current.filter((t) => !selectedIds.has(t.id)));
      }
      if (images.some((img) => selectedIds.has(img.id))) {
        updateImages((current) => current.filter((img) => !selectedIds.has(img.id)));
      }
    },
    // Bilder kann das Lasso mit auswählen.
    items: [
      ...images.map((img) => ({
        id: img.id,
        box: { x: img.x, y: img.y + offsetOf(img), width: img.width, height: img.height },
      })),
      ...texts.map((t) => ({
        id: t.id,
        box: { x: t.x, y: t.y + offsetOf(t), width: t.width, height: textHeights[t.id] ?? 24 },
      })),
    ],
    onPlaceText: placeText,
    onSnip: (polygon) => {
      const box = boundsOfPolygon(polygon);
      const element = svgRef.current!.parentElement!; // die ganze Seite (Text + Zeichnungen)
      copySnipToClipboard(captureRegion(element, { ...box, x: box.x + layout.columnLeft }));
    },
  });

  // Wie weit reichen Zeichnungen und Bilder nach unten? (Damit sie nach dem Neuladen erreichbar bleiben.)
  const drawingBottom = Math.max(
    0,
    ...strokes.map((s) => Math.max(...s.points.map((p) => p[1])) + offsetOf(s)),
    ...images.map((img) => img.y + img.height + offsetOf(img)),
    ...texts.map((t) => t.y + (textHeights[t.id] ?? 24) + offsetOf(t)),
  );

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
          settings={toolSettings}
          onSettingsChange={updateToolSettings}
          allowText
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
          // unter dem Text immer mindestens eine Bildschirmhöhe Platz, unter Zeichnungen auch
          paddingBottom: viewport.height + extraHeight || undefined,
          minHeight: drawingBottom + viewport.height + extraHeight || undefined,
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
        lassoSelected={selection}
        lassoOffset={dragOffset}
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
          {eraser && <circle className="eraser-cursor" cx={eraser.x} cy={eraser.y} r={eraser.r} />}
          <LassoOverlay lasso={lasso} box={selectionBox} onDelete={deleteSelection} />
        </g>
      </svg>

      {/* Über der Zeichenschicht, damit man im Text-Werkzeug in vorhandene Felder tippen kann. */}
      <FloatingTexts
        texts={texts}
        columnLeft={layout.columnLeft}
        zoom={zoom}
        offsetOf={offsetOf}
        interactive={!penMode || tool === "text"}
        lassoSelected={selection}
        lassoOffset={dragOffset}
        onChange={(id, value) => updateTexts((current) => current.map((t) => (t.id === id ? { ...t, text: value } : t)))}
        onMove={(id, dx, dy) =>
          updateTexts((current) =>
            current.map((t) => (t.id === id ? anchorText({ ...t, x: t.x + dx, y: t.y + dy }) : t)),
          )
        }
        onResize={(id, width) => updateTexts((current) => current.map((t) => (t.id === id ? { ...t, width } : t)))}
        onDelete={(id) => updateTexts((current) => current.filter((t) => t.id !== id))}
        onMeasure={(id, height) =>
          setTextHeights((current) => (current[id] === height ? current : { ...current, [id]: height }))
        }
      />
      </div>
      </div>
    </>
  );
}
