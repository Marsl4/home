// Wiederverwendbare Stift-Logik: aus Maus-/Trackpad-/Stift-Bewegungen Striche machen,
// radieren und mit dem Lasso auswählen + verschieben.
// Benutzt von der Zeichenschicht auf Notizseiten und von den PDF-Seiten.
// Auf dem iPad zeichnet nur der Apple Pencil – Finger scrollen und zoomen ganz normal.
import { useEffect, useRef, useState, type RefObject } from "react";

import { usePaneFocused } from "../components/PaneContext";
import { recognizeShape, transformShape, type ShapeKind } from "./shapes";
import {
  boundsOf,
  boxInLasso,
  unionBoxes,
  eraseFromStroke,
  hitsStroke,
  straightenHighlight,
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
  size: number; // Strichdicke für neue Striche
  eraserRadius: number;
  eraserMode: "stroke" | "precise"; // ganzer Strich weg / nur der überfahrene Teil
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
  // (dx, dy = Verschiebung, damit auch ausgewählte Bilder/Textfelder mitwandern können)
  onMoveDone: (next: Stroke[], movedIds: Set<string>, dx: number, dy: number) => void;
  // ausgewählte Striche gelöscht; selectedIds enthält auch ausgewählte Bilder/Textfelder
  onDeleteSelection: (next: Stroke[], selectedIds: Set<string>) => void;
  // Weitere Dinge, die das Lasso mit auswählen kann (Bilder …), mit ihrem Rahmen in eigenen Koordinaten.
  items?: { id: string; box: Box }[];
  // Ausschnitt-Werkzeug: Bereich wurde eingekreist (Linie in eigenen Koordinaten)
  onSnip: (polygon: [number, number][]) => void;
  // Text-Werkzeug: an dieser Stelle wurde hingetippt
  onPlaceText?: (x: number, y: number) => void;
};

const NO_SELECTION = new Set<string>();

// Formerkennung (nur Stift): so lange am Ende stillhalten, dann wird die Linie zur sauberen Form.
const HOLD_TO_SNAP_MS = 1000;
const STILL_DISTANCE = 4; // so viele Bildschirm-Pixel Zittern gelten noch als "stillhalten"

export function useStrokeInput(options: Options) {
  const { enabled, tool, color, strokes, toPoint, offsetOf = () => 0 } = options;
  const paneFocused = usePaneFocused(); // Tastenkürzel nur in der aktiven Hälfte
  const [draft, setDraft] = useState<Stroke | null>(null); // Strich, der gerade entsteht
  const strokesBeforeErasing = useRef<Stroke[] | null>(null); // null = es wird nicht radiert
  const activePointer = useRef<number | null>(null); // der Stift/die Maus, die gerade zeichnet
  const textTap = useRef<[number, number] | null>(null); // Text-Werkzeug: wo angetippt wurde
  const draftPathRef = useRef<SVGPathElement>(null); // Linie, die gerade entsteht (direkt aktualisiert)
  const holdTimer = useRef(0);
  const holdOrigin = useRef({ x: 0, y: 0 }); // wo der Stift zuletzt "angekommen" ist
  const snapped = useRef(false); // Linie wurde schon zur Form gemacht
  // Eingerastete Form: Ausgangsform + wo der Stift beim Einrasten war (für Größer/Kleiner-Ziehen).
  const shapeEdit = useRef<{ kind: ShapeKind; base: Stroke["points"]; grab: [number, number] } | null>(null);

  // Stillhalten erkannt: Linie durch die erkannte Form ersetzen (falls eine passt).
  const startHoldTimer = (stroke: Stroke) => {
    clearTimeout(holdTimer.current);
    if (stroke.tool !== "pen") return; // Textmarker: kommt später (abgewandelt)
    holdTimer.current = window.setTimeout(() => {
      const shape = recognizeShape(stroke.points);
      if (!shape) return;
      const last = stroke.points[stroke.points.length - 1];
      shapeEdit.current = { kind: shape.kind, base: shape.points, grab: [last[0], last[1]] };
      stroke.points.splice(0, stroke.points.length, ...shape.points);
      stroke.shape = true;
      snapped.current = true;
      draftPathRef.current?.setAttribute("d", strokeToPath(stroke));
    }, HOLD_TO_SNAP_MS);
  };
  useEffect(() => () => clearTimeout(holdTimer.current), []);

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
  const items = options.items ?? [];
  const selectedItemBoxes = items.filter((item) => selection.has(item.id)).map((item) => item.box);
  const strokeBox = boundsOf(selected.map((s) => ({ stroke: s, dy: offsetOf(s) })));
  const baseBox = unionBoxes([...(strokeBox ? [strokeBox] : []), ...selectedItemBoxes]);
  const selectionBox: Box | null = baseBox && {
    ...baseBox,
    x: baseBox.x + (drag?.dx ?? 0),
    y: baseBox.y + (drag?.dy ?? 0),
  };

  const isInside = (box: Box, x: number, y: number) =>
    x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;

  const deleteSelection = () => {
    options.onDeleteSelection(strokes.filter((s) => !selection.has(s.id)), selection);
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
  const erasing = useRef<Stroke[]>([]); // neuester Stand während des Radierens
  const lastErasePoint = useRef<[number, number] | null>(null);
  const [eraserAt, setEraserAt] = useState<[number, number] | null>(null); // Kreis unter dem Stift

  const eraseOnce = (list: Stroke[], x: number, y: number): Stroke[] => {
    const radius = options.eraserRadius;
    if (options.eraserMode === "stroke") return list.filter((s) => !hitsStroke(s, x, y, offsetOf(s), radius));
    return list.flatMap((s) => eraseFromStroke(s, x, y, offsetOf(s), radius) ?? [s]);
  };

  const eraseAt = (event: PointerPosition) => {
    const [x, y] = toPoint(event);
    setEraserAt([x, y]);
    // Bei schnellen Bewegungen auch die Strecke dazwischen radieren (sonst bleiben Lücken).
    const from = lastErasePoint.current ?? [x, y];
    const steps = Math.max(1, Math.ceil(Math.hypot(x - from[0], y - from[1]) / (options.eraserRadius / 2)));
    let next = erasing.current;
    for (let i = 1; i <= steps; i++) {
      next = eraseOnce(next, from[0] + ((x - from[0]) * i) / steps, from[1] + ((y - from[1]) * i) / steps);
    }
    lastErasePoint.current = [x, y];
    if (next !== erasing.current && changed(next, erasing.current)) {
      erasing.current = next;
      options.onErase(next);
    }
  };

  // ---------- Zeiger-Ereignisse ----------
  const onPointerDown = (event: React.PointerEvent) => {
    // Finger zeichnen nicht (sie scrollen/zoomen). Maus, Trackpad und Stift schon.
    if (event.pointerType === "touch" || activePointer.current !== null) return;
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const [x, y] = toPoint(event);

    if (tool === "text") {
      textTap.current = [x, y];
      return;
    }

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
      erasing.current = strokes;
      lastErasePoint.current = null;
      eraseAt(event);
      return;
    }

    const stroke: Stroke = {
      id: crypto.randomUUID(),
      tool,
      color,
      points: [[x, y, event.pressure || 0.5]],
      anchorBlockId: null,
      anchorTop: 0,
      realPressure: event.pointerType === "pen",
      size: options.size,
    };
    snapped.current = false;
    shapeEdit.current = null;
    holdOrigin.current = { x: event.clientX, y: event.clientY };
    startHoldTimer(stroke);
    setDraft(stroke);
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
    if (snapped.current) {
      // Eingerastete Form: Stift weiterbewegen = Form größer/kleiner ziehen (Linie: Ende folgt dem Stift).
      const edit = shapeEdit.current;
      if (!edit) return;
      const [x, y] = toPoint(event);
      draft.points.splice(0, draft.points.length, ...transformShape(edit.kind, edit.base, edit.grab, [x, y]));
      draftPathRef.current?.setAttribute("d", strokeToPath(draft));
      return;
    }
    // Bewegt sich der Stift (mehr als nur Zittern), beginnt das Warten aufs Stillhalten von vorn.
    if (Math.hypot(event.clientX - holdOrigin.current.x, event.clientY - holdOrigin.current.y) > STILL_DISTANCE) {
      holdOrigin.current = { x: event.clientX, y: event.clientY };
      startHoldTimer(draft);
    }
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
    clearTimeout(holdTimer.current);
    if (textTap.current) {
      const [x, y] = textTap.current;
      textTap.current = null;
      options.onPlaceText?.(x, y); // beim Loslassen, damit sich auf dem iPad die Tastatur öffnen darf
      return;
    }
    if (drag) {
      setDrag(null);
      // Endposition direkt vom Loslassen nehmen (die letzte Bewegung ist evtl. noch nicht im Zustand).
      const [x, y] = toPoint(event);
      const dx = x - drag.start[0];
      const dy = y - drag.start[1];
      if (dx !== 0 || dy !== 0) {
        const next = strokes.map((s) => (selection.has(s.id) ? moveStroke(s, dx, dy) : s));
        options.onMoveDone(next, selection, dx, dy);
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
        const caughtItems = items.filter((item) => boxInLasso(item.box, lasso));
        setSelection(new Set([...caught.map((s) => s.id), ...caughtItems.map((item) => item.id)]));
      }
      return;
    }
    const before = strokesBeforeErasing.current;
    if (before) {
      strokesBeforeErasing.current = null;
      setEraserAt(null);
      if (before !== strokes) options.onEraseDone(before);
      return;
    }
    if (!draft) return;
    setDraft(null);
    // Textmarker: längere, ungefähr gerade Markierungen werden sauber gerade.
    const straight = draft.tool === "highlighter" ? straightenHighlight(draft.points) : null;
    options.onStrokeDone({ ...draft, points: straight ?? [...draft.points], shape: draft.shape || !!straight });
  };

  return {
    draft,
    draftPathRef, // an das <path> der entstehenden Linie hängen
    // Radierer-Kreis (Mitte + Radius in eigenen Koordinaten), solange radiert wird
    eraser: eraserAt && { x: eraserAt[0], y: eraserAt[1], r: options.eraserRadius },
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    lasso,
    selection,
    selectionBox,
    deleteSelection,
    // Verschiebung, die ausgewählte Striche gerade (während des Ziehens) zusätzlich bekommen.
    dragOffset: drag ? { dx: drag.dx, dy: drag.dy } : { dx: 0, dy: 0 },
  };
}

// Hat sich die Strich-Liste geändert? (Anzahl oder einzelne Striche)
function changed(a: Stroke[], b: Stroke[]): boolean {
  return a.length !== b.length || a.some((s, i) => s !== b[i]);
}

// Tastenkürzel im Stift-Modus: Esc = fertig, Cmd+Z = rückgängig.
export function usePenShortcuts(penMode: boolean, onExit: () => void, onUndo: () => void) {
  const paneFocused = usePaneFocused(); // im Split-Modus nur die aktive Hälfte
  useEffect(() => {
    if (!penMode || !paneFocused) return;
    const onKey = (event: KeyboardEvent) => {
      // In einem Textfeld gehören Esc und ⌘Z dem Text, nicht den Strichen.
      const target = event.target as HTMLElement;
      if (target.isContentEditable || ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
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
