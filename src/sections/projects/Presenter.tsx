// Vollbild-Präsentation: eine Folie (PDF-Seite) füllt den ganzen Bildschirm.
// Weiter: → ↓ Leertaste Bild↓ Enter, Tippen rechts, nach links wischen.
// Zurück: ← ↑ Bild↑, Tippen links, nach rechts wischen. Pos1/Ende: erste/letzte Folie. Beenden: Esc oder ✕.
// (Präsentations-Fernbedienungen senden meist Bild↑/Bild↓ – funktionieren also auch.)
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { getDocument, RenderingCancelledException, type PDFDocumentProxy } from "../pdfs/pdfjs";
import { exitFullscreen, isFullscreen } from "./fullscreen";

const MAX_CANVAS_PIXELS = 16_000_000; // Grenze für sehr große Bildschirme (Speicher, v. a. iPad)
const HIDE_CONTROLS_AFTER = 2500; // ms ohne Bewegung → Leiste ausblenden

type Props = {
  loadFile: () => Promise<Blob | undefined>;
  startPage?: number; // ab 1
  onClose: () => void;
};

export function Presenter({ loadFile, startPage = 1, onClose }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(startPage - 1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [screen, setScreen] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadRef = useRef(loadFile);
  const count = doc?.numPages ?? 0;

  // PDF laden (einmal)
  useEffect(() => {
    let task: ReturnType<typeof getDocument> | null = null;
    let cancelled = false;
    loadRef.current()
      .then(async (file) => {
        if (!file) throw new Error("Die Folien wurden nicht gefunden.");
        task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
        const loaded = await task.promise;
        if (!cancelled) setDoc(loaded);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
      task?.destroy();
    };
  }, []);

  const close = useCallback(() => {
    exitFullscreen();
    onClose();
  }, [onClose]);

  const go = useCallback(
    (delta: number) => setIndex((current) => Math.max(0, Math.min((doc?.numPages ?? 1) - 1, current + delta))),
    [doc],
  );

  // Tastatur
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const next = ["ArrowRight", "ArrowDown", " ", "PageDown", "Enter"];
      const previous = ["ArrowLeft", "ArrowUp", "PageUp", "Backspace"];
      if (next.includes(e.key)) go(1);
      else if (previous.includes(e.key)) go(-1);
      else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(Math.max(0, count - 1));
      else if (e.key === "Escape") close();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true); // vor allen anderen Tastenkürzeln der App
    return () => window.removeEventListener("keydown", onKey, true);
  }, [go, close, count]);

  // Verlässt man das Vollbild über den Browser (z. B. Esc am Mac), auch die Präsentation beenden.
  useEffect(() => {
    const wasFullscreen = { current: isFullscreen() };
    const onChange = () => {
      if (wasFullscreen.current && !isFullscreen()) onClose();
      wasFullscreen.current = isFullscreen();
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, [onClose]);

  // Bildschirmgröße (Drehen des iPads, Vollbild an/aus)
  useEffect(() => {
    const onResize = () => setScreen({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Leiste nach kurzer Zeit ohne Bewegung ausblenden
  const hideTimer = useRef<number | undefined>(undefined);
  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), HIDE_CONTROLS_AFTER);
  }, []);
  useEffect(() => {
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), HIDE_CONTROLS_AFTER);
    return () => clearTimeout(hideTimer.current);
  }, []);

  // Aktuelle Folie scharf und so groß wie möglich zeichnen
  const [slideSize, setSlideSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!doc) return;
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | null = null;
    let cancelled = false;
    doc.getPage(index + 1).then((page) => {
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const fit = Math.min(screen.w / base.width, screen.h / base.height); // ganze Folie sichtbar
      const sharp = fit * window.devicePixelRatio;
      const scale = Math.min(sharp, Math.sqrt(MAX_CANVAS_PIXELS / (base.width * base.height)));
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current!;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      setSlideSize({ w: base.width * fit, h: base.height * fit });
      task = page.render({ canvas, viewport });
      task.promise.catch((e) => {
        if (!(e instanceof RenderingCancelledException)) console.error(e);
      });
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, index, screen]);

  // Tippen/Klicken: linkes Drittel zurück, sonst weiter. Wischen: Richtung entscheidet.
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1); // Wischen
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) go(e.clientX < window.innerWidth / 3 ? -1 : 1); // Tippen
    showControls();
  };

  return createPortal(
    <div
      className={`presenter ${controlsVisible ? "" : "hide-controls"}`}
      onPointerMove={(e) => e.pointerType === "mouse" && showControls()}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      role="dialog"
      aria-label="Präsentation"
    >
      {error ? (
        <p className="presenter-message">{error}</p>
      ) : !doc ? (
        <p className="presenter-message">Folien werden geladen …</p>
      ) : null}
      <canvas
        ref={canvasRef}
        className="presenter-slide"
        style={slideSize ? { width: slideSize.w, height: slideSize.h } : { visibility: "hidden" }}
      />
      <div className="presenter-controls" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <button onClick={() => go(-1)} disabled={index === 0} title="Vorherige Folie (←)">
          <ChevronLeft size={20} />
        </button>
        <span>
          {count ? index + 1 : "–"} / {count || "–"}
        </span>
        <button onClick={() => go(1)} disabled={index >= count - 1} title="Nächste Folie (→)">
          <ChevronRight size={20} />
        </button>
        <button onClick={close} title="Präsentation beenden (Esc)">
          <X size={20} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
