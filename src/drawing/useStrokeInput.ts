// Wiederverwendbare Stift-Logik: aus Maus-/Trackpad-/Stift-Bewegungen Striche machen und radieren.
// Benutzt von der Zeichenschicht auf Notizseiten und von den PDF-Seiten.
import { useEffect, useRef, useState } from "react";

import { hitsStroke, type Stroke, type Tool } from "./strokes";

export type PointerPosition = { clientX: number; clientY: number; pressure: number };

type Options = {
  tool: Tool;
  color: string;
  strokes: Stroke[];
  // Bildschirmposition -> eigene Koordinaten [x, y, Druck]
  toPoint: (event: PointerPosition) => [number, number, number];
  // Wie weit ein gespeicherter Strich gerade nach unten verschoben angezeigt wird (Standard 0).
  offsetOf?: (stroke: Stroke) => number;
  onStrokeDone: (stroke: Stroke) => void; // neuer Strich fertig
  onErase: (remaining: Stroke[]) => void; // während des Radierens
  onEraseDone: (before: Stroke[]) => void; // Radieren beendet und es wurde etwas entfernt
};

export function useStrokeInput(options: Options) {
  const { tool, color, strokes, toPoint, offsetOf = () => 0 } = options;
  const [draft, setDraft] = useState<Stroke | null>(null); // Strich, der gerade entsteht
  const strokesBeforeErasing = useRef<Stroke[] | null>(null); // null = es wird nicht radiert

  const eraseAt = (event: PointerPosition) => {
    const [x, y] = toPoint(event);
    const remaining = strokes.filter((s) => !hitsStroke(s, x, y, offsetOf(s)));
    if (remaining.length !== strokes.length) options.onErase(remaining);
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
      if (before !== strokes) options.onEraseDone(before);
      return;
    }
    if (!draft) return;
    setDraft(null);
    options.onStrokeDone(draft);
  };

  return {
    draft,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}

// Tastenkürzel im Stift-Modus: Esc = fertig, Cmd+Z = rückgängig.
export function usePenShortcuts(penMode: boolean, onExit: () => void, onUndo: () => void) {
  useEffect(() => {
    if (!penMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExit();
      if (event.key === "z" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}
