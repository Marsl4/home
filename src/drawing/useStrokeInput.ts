// Wiederverwendbare Stift-Logik: aus Maus-/Trackpad-/Stift-Bewegungen Striche machen,
// radieren und mit dem Lasso auswählen + verschieben.
// Benutzt von der Zeichenschicht auf Notizseiten und von den PDF-Seiten.
// Auf dem iPad zeichnet nur der Apple Pencil – Finger scrollen und zoomen ganz normal.
import { useEffect, useRef, useState, type RefObject } from "react";

import { usePaneFocused } from "../components/PaneContext";
import {
  boundsOf,
  hitsStroke,
  moveStroke,
  strokeInLasso,
  strokeToPath,
  type Box,
  type Stroke,
  type Tool,
} from "./strokes";

export type PointerPosition = { clientX: number; clientY: number; pressure: number };

type Options = {
  enabled: boolean; // Stift-Modus an?
  surfaceRef: RefObject<Element | null>; // die Zeichenfläche (für die Stift-Erkennung auf dem iPad)
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
  // Lasso: ausgewählte Striche wurden verschoben (next = alle Striche, verschobene schon geändert)
  onMoveDone: (next: Stroke[], movedIds: Set<string>) => void;
  onDeleteSelection: (next: Stroke[]) => void; // ausgewählte Striche gelöscht
  // Ausschnitt-Werkzeug: Bereich wurde eingekreist (Linie in eigenen Koordinaten)
  onSnip: (polygon: [number, number][]) => void;
};

const NO_SELECTION = new Set<string>();

export function useStrokeInput(options: Options) {
  const { enabled, tool, color, strokes, toPoint, offsetOf = () => 0 } = options;
  const paneFocused = usePaneFocused(); // Tastenkürzel nur in der aktiven Hälfte
  const [draft, setDraft] = useState<Stroke | null>(null); // Strich, der gerade entsteht
  const strokesBeforeErasing = useRef<Stroke[] | null>(null); // null = es wird nicht radiert
  const activePointer = useRef<number | null>(null); // der Stift/die Maus, die gerade zeichnet
  const draftPathRef = useRef<SVGPathElement>(null); // Linie, die gerade entsteht (direkt aktualisiert)

  // ---------- Lasso-Zustand ----------
  const [lasso, setLasso] = useState<[number, number][] | null>(null); // Linie, die gerade gezogen wird
  const [selection, setSelection] = useState<Set<string>>(NO_SELECTION); // ausgewählte Strich-IDs
  const [drag, setDrag] = useState<{ start: [number, number]; dx: number; dy: number } | null>(null);

  // Auswahl aufheben, sobald Werkzeug oder Stift-Modus wechselt.
  const mode = `${enabled}-${tool}`;
  const [previousMode, setPreviousMode] = useState(mode);
  if (mode !== previousMode) {
    setPreviousMode(mode);
    setSelection(NO_SELECTION);
    setLasso(null);
    setDrag(null);
  }

  const selected = strokes.filter((s) => selection.has(s.id));
  const baseBox = boundsOf(selected.map((s) => ({ stroke: s, dy: offsetOf(s) })));
  const selectionBox: Box | null = baseBox && {
    ...baseBox,
    x: baseBox.x + (drag?.dx ?? 0),
    y: baseBox.y + (drag?.dy ?? 0),
  };

  const isInside = (box: Box, x: number, y: number) =>
    x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;

  const deleteSelection = () => {
    options.onDeleteSelection(strokes.filter((s) => !selection.has(s.id)));
    setSelection(NO_SELECTION);
  };

  // Entf/⌫ löscht die Auswahl (nicht, wenn gerade in einem Textfeld getippt wird).
  useEffect(() => {
    if (!enabled || !paneFocused || selection.size === 0) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.isContentEditable || ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        deleteSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Apple Pencil: dem Browser verbieten, mit dem Stift zu scrollen (Finger dürfen weiter scrollen).
  // Pointer-Events kommen trotzdem an – so malt der Stift ohne Verzögerung.
  useEffect(() => {
    const surface = options.surfaceRef.current;
    if (!enabled || !surface) return;
    const blockStylus = (event: Event) => {
      const touches = Array.from((event as TouchEvent).changedTouches ?? []);
      if (touches.some((t) => (t as Touch & { touchType?: string }).touchType === "stylus")) {
        event.preventDefault();
      }
    };
    surface.addEventListener("touchstart", blockStylus, { passive: false });
    surface.addEventListener("touchmove", blockStylus, { passive: false });
    return () => {
      surface.removeEventListener("touchstart", blockStylus);
      surface.removeEventListener("touchmove", blockStylus);
    };
  }, [enabled, options.surfaceRef]);

  // ---------- Radierer ----------
  const eraseAt = (event: PointerPosition) => {
    const [x, y] = toPoint(event);
    const remaining = strokes.filter((s) => !hitsStroke(s, x, y, offsetOf(s)));
    if (remaining.length !== strokes.length) options.onErase(remaining);
  };

  // ---------- Zeiger-Ereignisse ----------
  const onPointerDown = (event: React.PointerEvent) => {
    // Finger zeichnen nicht (sie scrollen/zoomen). Maus, Trackpad und Stift schon.
    if (event.pointerType === "touch" || activePointer.current !== null) return;
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const [x, y] = toPoint(event);

    if (tool === "snip") {
      setLasso([[x, y]]); // gleiche Linie wie beim Lasso, aber danach wird ein Bild kopiert
      return;
    }

    if (tool === "lasso") {
      if (selectionBox && isInside(selectionBox, x, y)) {
        setDrag({ start: [x, y], dx: 0, dy: 0 }); // Auswahl verschieben
      } else {
        setSelection(NO_SELECTION); // neues Lasso beginnen
        setLasso([[x, y]]);
      }
      return;
    }

    if (tool === "eraser") {
      strokesBeforeErasing.current = strokes;
      eraseAt(event);
      return;
    }

    setDraft({
      id: crypto.randomUUID(),
      tool,
      color,
      points: [[x, y, event.pressure || 0.5]],
      anchorBlockId: null,
      anchorTop: 0,
      realPressure: event.pointerType === "pen",
    });
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (event.pointerId !== activePointer.current) return;
    if (drag) {
      const [x, y] = toPoint(event);
      setDrag({ ...drag, dx: x - drag.start[0], dy: y - drag.start[1] });
      return;
    }
    if (lasso) {
      const [x, y] = toPoint(event);
      setLasso([...lasso, [x, y]]);
      return;
    }
    if (strokesBeforeErasing.current) return eraseAt(event);
    if (!draft) return;
    // "Coalesced events" = alle Zwischenpunkte, für glattere Linien (v. a. mit dem Stift).
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [];
    draft.points.push(...(events.length ? events : [event]).map(toPoint));
    // Für möglichst wenig Verzögerung: die Linie direkt neu zeichnen, ohne React neu rendern zu lassen.
    // (draft.points wird dafür bewusst direkt ergänzt; beim Loslassen wird eine Kopie gespeichert.)
    draftPathRef.current?.setAttribute("d", strokeToPath(draft));
  };

  const onPointerUp = (event: React.PointerEvent) => {
    if (event.pointerId !== activePointer.current) return;
    activePointer.current = null;
    if (drag) {
      setDrag(null);
      // Endposition direkt vom Loslassen nehmen (die letzte Bewegung ist evtl. noch nicht im Zustand).
      const [x, y] = toPoint(event);
      const dx = x - drag.start[0];
      const dy = y - drag.start[1];
      if (dx !== 0 || dy !== 0) {
        const next = strokes.map((s) => (selection.has(s.id) ? moveStroke(s, dx, dy) : s));
        options.onMoveDone(next, selection);
      }
      return;
    }
    if (lasso) {
      setLasso(null);
      if (tool === "snip") {
        if (lasso.length > 2) options.onSnip(lasso);
        return;
      }
      if (lasso.length > 2) {
        const caught = strokes.filter((s) => strokeInLasso(s, offsetOf(s), lasso));
        setSelection(new Set(caught.map((s) => s.id)));
      }
      return;
    }
    const before = strokesBeforeErasing.current;
    if (before) {
      strokesBeforeErasing.current = null;
      if (before !== strokes) options.onEraseDone(before);
      return;
    }
    if (!draft) return;
    setDraft(null);
    options.onStrokeDone({ ...draft, points: [...draft.points] });
  };

  return {
    draft,
    draftPathRef, // an das <path> der entstehenden Linie hängen
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    lasso,
    selection,
    selectionBox,
    deleteSelection,
    // Verschiebung, die ausgewählte Striche gerade (während des Ziehens) zusätzlich bekommen.
    dragOffset: drag ? { dx: drag.dx, dy: drag.dy } : { dx: 0, dy: 0 },
  };
}

// Tastenkürzel im Stift-Modus: Esc = fertig, Cmd+Z = rückgängig.
export function usePenShortcuts(penMode: boolean, onExit: () => void, onUndo: () => void) {
  const paneFocused = usePaneFocused(); // im Split-Modus nur die aktive Hälfte
  useEffect(() => {
    if (!penMode || !paneFocused) return;
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
