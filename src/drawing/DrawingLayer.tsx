// Durchsichtige Zeichenschicht über der ganzen Seite.
// - Stift-Modus aus: man tippt ganz normal im Editor, die Zeichnungen sind nur sichtbar.
// - Stift-Modus an: Maus/Trackpad/Stift malen auf der Seite.
// Jeder Strich merkt sich den Textblock darüber und wandert mit, wenn sich der Text verschiebt.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { savePageDrawing } from "../storage/db";
import { DrawingToolbar } from "./DrawingToolbar";
import { hitsStroke, PEN_COLORS, strokeToPath, type Stroke, type Tool } from "./strokes";

type Props = {
  pageId: string;
  initialStrokes: Stroke[];
  // Titel + Editor. Darüber liegt die Zeichenschicht.
  children: ReactNode;
};

type PointerPosition = { clientX: number; clientY: number; pressure: number };

type Layout = {
  columnLeft: number; // Abstand der Textspalte vom linken Rand
  blockTops: Record<string, number>; // Block-ID -> aktuelle Höhe auf der Seite
};

export function DrawingLayer({ pageId, initialStrokes, children }: Props) {
  const textRef = useRef<HTMLDivElement>(null); // daraus lesen wir, wo die Textblöcke liegen
  const svgRef = useRef<SVGSVGElement>(null);
  const [strokes, setStrokes] = useState(initialStrokes);
  const [draft, setDraft] = useState<Stroke | null>(null); // Strich, der gerade gezeichnet wird
  const [layout, setLayout] = useState<Layout>({ columnLeft: 0, blockTops: {} });

  const [penMode, setPenMode] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(PEN_COLORS[0]);

  const [history, setHistory] = useState<Stroke[][]>([]); // frühere Stände für "Rückgängig"
  // Stand vor dem Radieren (null = gerade wird nicht radiert).
  const strokesBeforeErasing = useRef<Stroke[] | null>(null);

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
  const offsetOf = (stroke: Stroke) => {
    const top = stroke.anchorBlockId ? layout.blockTops[stroke.anchorBlockId] : undefined;
    return top === undefined ? 0 : top - stroke.anchorTop;
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

  // Tastatur im Stift-Modus: Esc = fertig, Cmd+Z = rückgängig.
  useEffect(() => {
    if (!penMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPenMode(false);
      if (event.key === "z" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- Zeichnen mit Maus / Trackpad / Stift ----------
  const toPoint = (event: PointerPosition): [number, number, number] => {
    const origin = svgRef.current!.getBoundingClientRect();
    return [
      event.clientX - origin.left - layout.columnLeft,
      event.clientY - origin.top,
      event.pressure || 0.5,
    ];
  };

  const eraseAt = (event: PointerPosition) => {
    const [x, y] = toPoint(event);
    const remaining = strokes.filter((s) => !hitsStroke(s, x, y, offsetOf(s)));
    if (remaining.length !== strokes.length) save(remaining);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "eraser") {
      strokesBeforeErasing.current = strokes;
      eraseAt(event);
      return;
    }
    setDraft({
      id: crypto.randomUUID(),
      tool,
      color,
      points: [toPoint(event)],
      anchorBlockId: null,
      anchorTop: 0,
      realPressure: event.pointerType === "pen",
    });
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (strokesBeforeErasing.current) return eraseAt(event);
    if (!draft) return;
    // "Coalesced events" = alle Zwischenpunkte, für glattere Linien (v. a. mit dem Stift).
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const points = (events.length ? events : [event]).map(toPoint);
    setDraft({ ...draft, points: [...draft.points, ...points] });
  };

  const onPointerUp = () => {
    const before = strokesBeforeErasing.current;
    if (before) {
      strokesBeforeErasing.current = null;
      // Nur in den Verlauf, wenn wirklich etwas wegradiert wurde.
      if (before !== strokes) setHistory([...history, before]);
      return;
    }
    if (!draft) return;
    setDraft(null);

    // Anker suchen: der unterste Textblock, der oberhalb des Strichs beginnt.
    const strokeTop = Math.min(...draft.points.map(([, y]) => y));
    let anchorBlockId: string | null = null;
    let anchorTop = 0;
    for (const [id, top] of Object.entries(layout.blockTops)) {
      if (top <= strokeTop && (anchorBlockId === null || top >= anchorTop)) {
        anchorBlockId = id;
        anchorTop = top;
      }
    }
    commit([...strokes, { ...draft, anchorBlockId, anchorTop }]);
  };

  // SVG-Formen nur neu berechnen, wenn sich die Striche ändern.
  const paths = useMemo(() => new Map(strokes.map((s) => [s.id, strokeToPath(s)])), [strokes]);

  const renderStroke = (stroke: Stroke, path: string) => (
    <path
      key={stroke.id}
      d={path}
      fill={stroke.color}
      transform={`translate(${layout.columnLeft} ${offsetOf(stroke)})`}
      className={stroke.tool === "highlighter" ? "highlighter-stroke" : undefined}
    />
  );

  return (
    <div className="page-content">
      <div className="page-text" ref={textRef}>
        {children}
      </div>

      <svg
        ref={svgRef}
        className={`drawing-layer ${penMode ? "active" : ""} ${tool === "eraser" ? "erasing" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {strokes.map((s) => renderStroke(s, paths.get(s.id) ?? ""))}
        {draft && renderStroke({ ...draft, anchorBlockId: null }, strokeToPath(draft))}
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
