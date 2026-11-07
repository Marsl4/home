// Schmale Markierung am rechten (und, wenn gezoomt, unteren) Rand: zeigt, wo man im Blatt/PDF ist.
// Die Markierung lässt sich auch greifen und ziehen, um schnell weit zu scrollen.
// (Auf dem iPad blendet Safari die normalen Scrollbalken aus – daher diese eigene Anzeige.)
import { useEffect, useRef, useState, type RefObject } from "react";

type Bar = { start: number; size: number } | null; // in Pixeln entlang der Leiste
type Geometry = { left: number; top: number; width: number; height: number; vertical: Bar; horizontal: Bar };

const MIN_THUMB = 36;
const INSET = 3;

export function ScrollIndicator({ scrollRef }: { scrollRef: RefObject<HTMLElement | null> }) {
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [active, setActive] = useState(false); // gerade gescrollt/gezogen -> deutlicher anzeigen
  const fadeTimer = useRef(0);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    let frame = 0;
    const thumb = (scrollPos: number, scrollSize: number, clientSize: number, track: number): Bar => {
      if (scrollSize <= clientSize + 1) return null; // passt komplett hinein
      const size = Math.max(MIN_THUMB, (clientSize / scrollSize) * track);
      return { start: (scrollPos / (scrollSize - clientSize)) * (track - size), size };
    };
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = scroller.getBoundingClientRect();
        const trackV = box.height - 2 * INSET;
        const trackH = box.width - 2 * INSET - 12;
        setGeometry({
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          vertical: thumb(scroller.scrollTop, scroller.scrollHeight, scroller.clientHeight, trackV),
          horizontal: thumb(scroller.scrollLeft, scroller.scrollWidth, scroller.clientWidth, trackH),
        });
      });
    };
    const onScroll = () => {
      update();
      setActive(true);
      clearTimeout(fadeTimer.current);
      fadeTimer.current = window.setTimeout(() => setActive(false), 1200);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    const sizes = new ResizeObserver(update);
    sizes.observe(scroller);
    if (scroller.firstElementChild) sizes.observe(scroller.firstElementChild);
    const content = new MutationObserver(update); // Inhalt wird länger/kürzer
    content.observe(scroller, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
    update();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(fadeTimer.current);
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
      sizes.disconnect();
      content.disconnect();
    };
  }, [scrollRef]);

  // Markierung ziehen = scrollen.
  const startDrag = (event: React.PointerEvent, axis: "x" | "y") => {
    const scroller = scrollRef.current;
    if (!scroller || !geometry) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const bar = axis === "y" ? geometry.vertical! : geometry.horizontal!;
    const track = axis === "y" ? geometry.height - 2 * INSET : geometry.width - 2 * INSET - 12;
    const scrollSize = axis === "y" ? scroller.scrollHeight - scroller.clientHeight : scroller.scrollWidth - scroller.clientWidth;
    const startPointer = axis === "y" ? event.clientY : event.clientX;
    const startScroll = axis === "y" ? scroller.scrollTop : scroller.scrollLeft;
    const perPixel = scrollSize / Math.max(1, track - bar.size);
    const target = event.currentTarget as HTMLElement;
    const onMove = (e: PointerEvent) => {
      const delta = ((axis === "y" ? e.clientY : e.clientX) - startPointer) * perPixel;
      if (axis === "y") scroller.scrollTop = startScroll + delta;
      else scroller.scrollLeft = startScroll + delta;
    };
    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  };

  if (!geometry) return null;
  const { vertical, horizontal } = geometry;
  return (
    <>
      {vertical && (
        <div
          className={`scroll-thumb vertical ${active ? "active" : ""}`}
          style={{
            left: geometry.left + geometry.width - 14,
            top: geometry.top + INSET + vertical.start,
            height: vertical.size,
          }}
          onPointerDown={(e) => startDrag(e, "y")}
          title="Ziehen zum Scrollen"
        />
      )}
      {horizontal && (
        <div
          className={`scroll-thumb horizontal ${active ? "active" : ""}`}
          style={{
            left: geometry.left + INSET + horizontal.start,
            top: geometry.top + geometry.height - 14,
            width: horizontal.size,
          }}
          onPointerDown={(e) => startDrag(e, "x")}
        />
      )}
    </>
  );
}
