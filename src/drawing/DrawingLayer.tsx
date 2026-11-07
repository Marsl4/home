// Durchsichtige Zeichenschicht über der ganzen Seite.
// - Stift-Modus aus: man tippt ganz normal im Editor, die Zeichnungen sind nur sichtbar.
// - Stift-Modus an: Maus/Trackpad/Stift malen auf der Seite.
// Jeder Strich merkt sich den Textblock darüber und wandert mit, wenn sich der Text verschiebt.
// Außerdem liegen hier die frei platzierbaren Bilder (eingefügt mit ⌘V), die genauso mitwandern.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { savePageDrawing, savePageImages } from "../storage/db";
import { DrawingToolbar } from "./DrawingToolbar";
import { FloatingImages } from "./FloatingImages";
import { fileToDataUrl, initialImageSize, type FloatingImage } from "./images";
import { LassoOverlay } from "./LassoOverlay";
import { boundsOfPolygon, captureRegion, copySnipToClipboard } from "./snip";
import { PEN_COLORS, strokeToPath, type Stroke, type Tool } from "./strokes";
import { usePenShortcuts, useStrokeInput } from "./useStrokeInput";

type Props = {
  pageId: string;
  initialStrokes: Stroke[];
  initialImages: FloatingImage[];
  // Titel + Editor. Darüber liegt die Zeichenschicht.
  children: ReactNode;
};

// Alles, was an einem Textblock hängt (Striche und Bilder).
type Anchored = { anchorBlockId: string | null; anchorTop: number };

type Layout = {
  columnLeft: number; // Abstand der Textspalte vom linken Rand
  blockTops: Record<string, number>; // Block-ID -> aktuelle Höhe auf der Seite
};

export function DrawingLayer({ pageId, initialStrokes, initialImages, children }: Props) {
  const textRef = useRef<HTMLDivElement>(null); // daraus lesen wir, wo die Textblöcke liegen
  const svgRef = useRef<SVGSVGElement>(null);
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
        const origin = svg.getBoundingClientRect();
        const column = text.querySelector(".bn-container");
        const blockTops: Record<string, number> = {};
        text.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]").forEach((el) => {
          blockTops[el.dataset.id!] = el.getBoundingClientRect().top - origin.top;
        });
        setLayout({
          columnLeft: column ? column.getBoundingClientRect().left - origin.left : 0,
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

  // ---------- Ändern + Speichern ----------
  const save = (next: Stroke[]) => {
    setStrokes(next);
    savePageDrawing(pageId, next);
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
    if (block && textRef.current?.contains(block)) {
      return block.getBoundingClientRect().bottom - origin.top + 8;
    }
    return Math.max(0, -origin.top + 120);
  };

  // ⌘V mit einem Bild (z. B. einem Ausschnitt) -> als frei verschiebbare Box einfügen.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (!file) return; // normaler Text: macht der Editor selbst
      event.preventDefault();
      event.stopPropagation();
      const y = pastePositionY();
      (async () => {
        const src = await fileToDataUrl(file);
        const size = await initialImageSize(src);
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
  const { draft, handlers, lasso, selection, selectionBox, deleteSelection, dragOffset } =
    useStrokeInput({
    enabled: penMode,
    tool,
    color,
    strokes,
    offsetOf,
    toPoint: (event) => {
      const origin = svgRef.current!.getBoundingClientRect();
      return [
        event.clientX - origin.left - layout.columnLeft,
        event.clientY - origin.top,
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

  const renderStroke = (stroke: Stroke, path: string) => {
    const isSelected = selection.has(stroke.id);
    const dx = isSelected ? dragOffset.dx : 0;
    const dy = offsetOf(stroke) + (isSelected ? dragOffset.dy : 0);
    const classes = [stroke.tool === "highlighter" ? "highlighter-stroke" : "", isSelected ? "selected" : ""];
    return (
      <path
        key={stroke.id}
        d={path}
        fill={stroke.color}
        transform={`translate(${layout.columnLeft + dx} ${dy})`}
        className={classes.join(" ").trim() || undefined}
      />
    );
  };

  return (
    <div className="page-content">
      <div className="page-text" ref={textRef}>
        {children}
      </div>

      <FloatingImages
        images={images}
        columnLeft={layout.columnLeft}
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
        {draft && renderStroke({ ...draft, anchorBlockId: null }, strokeToPath(draft))}
        <g transform={`translate(${layout.columnLeft} 0)`}>
          <LassoOverlay lasso={lasso} box={selectionBox} onDelete={deleteSelection} />
        </g>
      </svg>

      <DrawingToolbar
        penMode={penMode}
        onTogglePenMode={() => setPenMode(!penMode)}
        tool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={setColor}
        canUndo={history.length > 0}
        onUndo={undo}
      />
    </div>
  );
}
