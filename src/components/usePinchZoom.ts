// Zoomen nur innerhalb einer Ansicht (Notizblatt, PDF) – der Rest der App bleibt gleich groß.
// Funktioniert mit
//  - zwei Fingern auf dem iPad (der Apple Pencil zählt nicht mit),
//  - Trackpad-Zoom am Mac (Safari: "gesture"-Ereignisse, Chrome: Mausrad mit Strg),
// Während der Geste wird nur ein Vorschau-Bild vergrößert (flüssig); erst am Ende wird der neue
// Zoom wirklich übernommen und die Scroll-Position so gesetzt, dass die Stelle unter den Fingern bleibt.
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

type Options = {
  scrollRef: RefObject<HTMLElement | null>; // der Bereich, der scrollt
  contentRef: RefObject<HTMLElement | null>; // der Inhalt darin (bekommt während der Geste die Vorschau)
  zoom: number;
  setZoom: (zoom: number) => void;
  min: number;
  max: number;
};

type Gesture = {
  startZoom: number;
  ratio: number; // Vergrößerung seit Beginn der Geste
  focusX: number; // Mittelpunkt der Geste, relativ zum sichtbaren Bereich
  focusY: number;
  moveX: number; // wie weit sich die Finger seit Beginn verschoben haben
  moveY: number;
  startDistance: number; // Abstand der Finger zu Beginn (nur Touch)
  offsetX: number; // wo der Inhalt im Scroll-Bereich beginnt (Rand oben/links zoomt nicht mit)
  offsetY: number;
};

type Point = { clientX: number; clientY: number };

const isStylus = (touch: Touch) => (touch as Touch & { touchType?: string }).touchType === "stylus";

export function usePinchZoom({ scrollRef, contentRef, zoom, setZoom, min, max }: Options) {
  const gesture = useRef<Gesture | null>(null);
  const pendingScroll = useRef<{ left: number; top: number } | null>(null);
  const wheelTimer = useRef(0);
  // Aktuelle Werte für die Ereignis-Funktionen (die nur einmal angemeldet werden).
  const latest = useRef({ zoom, setZoom, min, max });
  useLayoutEffect(() => {
    latest.current = { zoom, setZoom, min, max };
  });

  // Nach dem Übernehmen des neuen Zooms: Vorschau entfernen und Scroll-Position setzen –
  // im selben Bild, damit nichts springt.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (content) content.style.transform = "";
    if (scroller && pendingScroll.current) {
      scroller.scrollLeft = pendingScroll.current.left;
      scroller.scrollTop = pendingScroll.current.top;
      pendingScroll.current = null;
    }
  }, [zoom, scrollRef, contentRef]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const clamp = (value: number) => Math.min(latest.current.max, Math.max(latest.current.min, value));

    const begin = (center: Point, startDistance = 0) => {
      const box = scroller.getBoundingClientRect();
      const content = contentRef.current;
      const contentBox = content?.getBoundingClientRect() ?? box;
      gesture.current = {
        startZoom: latest.current.zoom,
        ratio: 1,
        focusX: center.clientX - box.left,
        focusY: center.clientY - box.top,
        moveX: 0,
        moveY: 0,
        startDistance,
        offsetX: contentBox.left - box.left + scroller.scrollLeft,
        offsetY: contentBox.top - box.top + scroller.scrollTop,
      };
      if (content) {
        content.style.transformOrigin = `${center.clientX - contentBox.left}px ${center.clientY - contentBox.top}px`;
      }
    };

    const preview = () => {
      const g = gesture.current;
      const content = contentRef.current;
      if (!g || !content) return;
      g.ratio = clamp(g.startZoom * g.ratio) / g.startZoom; // nicht über die Grenzen hinaus
      content.style.transform = `translate(${g.moveX}px, ${g.moveY}px) scale(${g.ratio})`;
    };

    const finish = () => {
      const g = gesture.current;
      gesture.current = null;
      if (!g) return;
      const newZoom = clamp(g.startZoom * g.ratio);
      const ratio = newZoom / g.startZoom;
      if (Math.abs(ratio - 1) < 0.01) {
        if (contentRef.current) contentRef.current.style.transform = "";
        return;
      }
      // Die Stelle, die zu Beginn unter den Fingern lag, soll danach unter den Fingern liegen.
      pendingScroll.current = {
        left: g.offsetX + (scroller.scrollLeft + g.focusX - g.offsetX) * ratio - (g.focusX + g.moveX),
        top: g.offsetY + (scroller.scrollTop + g.focusY - g.offsetY) * ratio - (g.focusY + g.moveY),
      };
      latest.current.setZoom(newZoom);
    };

    // ---------- iPad: zwei Finger ----------
    const fingers = (event: TouchEvent) => Array.from(event.touches).filter((t) => !isStylus(t));
    const distance = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const middle = (a: Touch, b: Touch): Point => ({
      clientX: (a.clientX + b.clientX) / 2,
      clientY: (a.clientY + b.clientY) / 2,
    });

    const onTouchStart = (event: TouchEvent) => {
      const [a, b] = fingers(event);
      if (!b) return;
      event.preventDefault();
      begin(middle(a, b), distance(a, b));
    };
    const onTouchMove = (event: TouchEvent) => {
      const g = gesture.current;
      const [a, b] = fingers(event);
      if (!g || !b || !g.startDistance) return;
      event.preventDefault();
      const box = scroller.getBoundingClientRect();
      const center = middle(a, b);
      g.ratio = distance(a, b) / g.startDistance;
      g.moveX = center.clientX - box.left - g.focusX;
      g.moveY = center.clientY - box.top - g.focusY;
      preview();
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (gesture.current?.startDistance && fingers(event).length < 2) finish();
    };

    // ---------- Mac-Trackpad in Chrome/Firefox: Mausrad mit Strg ----------
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return; // normales Scrollen
      event.preventDefault();
      if (!gesture.current) begin(event);
      gesture.current!.ratio *= Math.exp(-event.deltaY * 0.01);
      preview();
      clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(finish, 200);
    };

    // ---------- Mac-Trackpad in Safari: "gesture"-Ereignisse ----------
    // Auf dem iPad kommen diese zusätzlich zu den Touch-Ereignissen – dort nur das Browser-Zoomen verhindern.
    const hasTouch = "ontouchstart" in window;
    type GestureEvent = Event & Point & { scale: number };
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      if (!hasTouch) begin(event as GestureEvent);
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      if (hasTouch || !gesture.current) return;
      gesture.current.ratio = (event as GestureEvent).scale;
      preview();
    };
    const onGestureEnd = (event: Event) => {
      event.preventDefault();
      if (!hasTouch) finish();
    };

    const active = { passive: false };
    scroller.addEventListener("touchstart", onTouchStart, active);
    scroller.addEventListener("touchmove", onTouchMove, active);
    scroller.addEventListener("touchend", onTouchEnd);
    scroller.addEventListener("touchcancel", onTouchEnd);
    scroller.addEventListener("wheel", onWheel, active);
    scroller.addEventListener("gesturestart", onGestureStart, active);
    scroller.addEventListener("gesturechange", onGestureChange, active);
    scroller.addEventListener("gestureend", onGestureEnd, active);
    return () => {
      clearTimeout(wheelTimer.current);
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("touchcancel", onTouchEnd);
      scroller.removeEventListener("wheel", onWheel);
      scroller.removeEventListener("gesturestart", onGestureStart);
      scroller.removeEventListener("gesturechange", onGestureChange);
      scroller.removeEventListener("gestureend", onGestureEnd);
    };
  }, [scrollRef, contentRef]);
}
