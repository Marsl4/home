// Eine einzelne PDF-Seite: das gerenderte Bild + eine Zeichenschicht darüber.
// Die Seite wird erst gerendert, wenn sie in die Nähe des sichtbaren Bereichs kommt (spart Zeit bei langen PDFs).
import { useEffect, useMemo, useRef, useState } from "react";

import { strokeToPath, type Stroke, type Tool } from "../../drawing/strokes";
import { LassoOverlay } from "../../drawing/LassoOverlay";
import { boundsOfPolygon, capturePdfRegion, copySnipToClipboard } from "../../drawing/snip";
import { useStrokeInput } from "../../drawing/useStrokeInput";
import { RenderingCancelledException, type PDFDocumentProxy } from "./pdfjs";

// Auflösung für Ausschnitte: 4 Bildpunkte pro PDF-Einheit (≈ 290 dpi, sehr scharf).
const SNIP_SCALE = 4;
// Höchstens so viele Bildpunkte pro Seite (das iPad schafft ~16 Mio. pro Canvas, und Speicher ist knapp).
const MAX_CANVAS_PIXELS = 10_000_000;

type Props = {
  doc: PDFDocumentProxy;
  index: number; // Seitennummer ab 0
  size: [number, number]; // Breite/Höhe in PDF-Einheiten
  displayWidth: number; // angezeigte Breite in Pixeln
  strokes: Stroke[];
  penMode: boolean;
  tool: Tool;
  color: string;
  strokeSize: number; // Strichdicke (in PDF-Einheiten)
  eraserRadiusPx: number; // Radierer-Größe auf dem Bildschirm
  eraserMode: "stroke" | "precise";
  highlight: string; // Suchbegriff, der auf der Seite gelb markiert wird ("" = keiner)
  onCommit: (strokes: Stroke[]) => void; // neuer Strich (kommt in den Verlauf)
  onErase: (strokes: Stroke[]) => void; // während des Radierens
  onEraseDone: (before: Stroke[]) => void;
};

export function PdfPage(props: Props) {
  const { doc, index, size, displayWidth, strokes, penMode, tool, color } = props;
  const [width, height] = size;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [marks, setMarks] = useState<{ x: number; y: number; w: number; h: number }[]>([]);

  // Suchtreffer auf dieser Seite markieren (Position aus dem Text der PDF-Seite, in PDF-Einheiten).
  const highlight = props.highlight.trim().toLocaleLowerCase("de");
  useEffect(() => {
    if (!nearViewport || highlight.length < 2) return; // dann werden keine Markierungen angezeigt (s. u.)
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(index + 1);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const found: { x: number; y: number; w: number; h: number }[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str) continue;
        const text = item.str.toLocaleLowerCase("de");
        const fontHeight = Math.hypot(item.transform[2], item.transform[3]) || item.height;
        const [x0, baseline] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        let from = 0;
        for (;;) {
          const i = text.indexOf(highlight, from);
          if (i === -1) break;
          found.push({
            x: x0 + (item.width * i) / text.length,
            y: baseline - fontHeight * 0.85,
            w: (item.width * highlight.length) / text.length,
            h: fontHeight * 1.1,
          });
          from = i + highlight.length;
        }
      }
      if (!cancelled) setMarks(found);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [doc, index, highlight, nearViewport]);

  // Nur Seiten in der Nähe des sichtbaren Bereichs werden gezeichnet. Weit entfernte Seiten geben ihr
  // Bild wieder frei – so bleibt der Arbeitsspeicher auch bei sehr langen PDFs klein.
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setNearViewport(entry.isIntersecting), {
      root: wrapperRef.current!.closest(".pdf-scroll"), // der scrollende Bereich (sonst wirkt der Rand nicht)
      rootMargin: "1500px 0px",
    });
    observer.observe(wrapperRef.current!);
    return () => observer.disconnect();
  }, []);

  // PDF-Seite ins Canvas zeichnen (scharf auch auf Retina-Bildschirmen).
  useEffect(() => {
    if (!nearViewport) {
      // weit weg: Bild freigeben (Breite 0 = Speicher sofort zurück, wichtig auf dem iPad)
      const canvas = canvasRef.current;
      if (canvas) canvas.width = canvas.height = 0;
      return;
    }
    if (displayWidth <= 0) return;
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | null = null;
    let cancelled = false;

    doc.getPage(index + 1).then((page) => {
      if (cancelled) return;
      const sharpScale = (displayWidth / width) * window.devicePixelRatio;
      const scale = Math.min(sharpScale, Math.sqrt(MAX_CANVAS_PIXELS / (width * height)));
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current!;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvas, viewport });
      task.promise.catch((error) => {
        if (!(error instanceof RenderingCancelledException)) console.error(error);
      });
    });

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, index, width, height, displayWidth, nearViewport]);

  // Zeichnen: Koordinaten in PDF-Einheiten, damit Striche beim Zoomen mitskalieren.
  const { draft, draftPathRef, eraser, handlers, lasso, selection, selectionBox, deleteSelection, dragOffset } =
    useStrokeInput({
    enabled: penMode,
    size: props.strokeSize,
    eraserRadius: (props.eraserRadiusPx * width) / displayWidth, // Bildschirm-Pixel -> PDF-Einheiten
    eraserMode: props.eraserMode,
    surfaceRef: svgRef,
    tool,
    color,
    strokes,
    toPoint: (event) => {
      const rect = svgRef.current!.getBoundingClientRect();
      return [
        ((event.clientX - rect.left) / rect.width) * width,
        ((event.clientY - rect.top) / rect.height) * height,
        event.pressure || 0.5,
      ];
    },
    onStrokeDone: (stroke) => props.onCommit([...strokes, stroke]),
    onErase: props.onErase,
    onEraseDone: props.onEraseDone,
    onMoveDone: (next) => props.onCommit(next),
    onDeleteSelection: props.onCommit,
    // Ausschnitt direkt aus dem PDF-Bild + den Strichen (alles in PDF-Einheiten).
    // Die Seite wird dafür extra in hoher Auflösung gezeichnet, damit auch kleine Schrift scharf ist.
    onSnip: (polygon) =>
      copySnipToClipboard(
        renderHighRes().then((canvas) =>
          capturePdfRegion(canvas, width, strokes, boundsOfPolygon(polygon)),
        ),
      ),
  });

  // Ganze Seite in hoher Auflösung (für Ausschnitte) zeichnen.
  async function renderHighRes(): Promise<HTMLCanvasElement> {
    const page = await doc.getPage(index + 1);
    const viewport = page.getViewport({ scale: SNIP_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, viewport }).promise;
    return canvas;
  }

  const paths = useMemo(() => new Map(strokes.map((s) => [s.id, strokeToPath(s)])), [strokes]);

  const renderStroke = (stroke: Stroke, path: string, ref?: React.Ref<SVGPathElement>) => {
    const isSelected = selection.has(stroke.id);
    const classes = [stroke.tool === "highlighter" ? "highlighter-stroke" : "", isSelected ? "selected" : ""];
    return (
      <path
        key={stroke.id}
        ref={ref}
        d={path}
        fill={stroke.color}
        transform={isSelected ? `translate(${dragOffset.dx} ${dragOffset.dy})` : undefined}
        className={classes.join(" ").trim() || undefined}
      />
    );
  };

  return (
    <div
      ref={wrapperRef}
      className="pdf-page"
      style={{ width: displayWidth, height: (displayWidth * height) / width }}
    >
      <canvas ref={canvasRef} />
      {(nearViewport && highlight.length >= 2 ? marks : []).map((m, i) => (
        <span
          key={i}
          className="pdf-search-mark"
          style={{ left: `${(m.x / width) * 100}%`, top: `${(m.y / height) * 100}%`, width: `${(m.w / width) * 100}%`, height: `${(m.h / height) * 100}%` }}
        />
      ))}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className={`pdf-ink ${penMode ? "active" : ""} tool-${tool}`}
        {...handlers}
      >
        {strokes.map((s) => renderStroke(s, paths.get(s.id) ?? ""))}
        {draft && renderStroke(draft, strokeToPath(draft), draftPathRef)}
        {eraser && <circle className="eraser-cursor" cx={eraser.x} cy={eraser.y} r={eraser.r} />}
        <LassoOverlay
          lasso={lasso}
          box={selectionBox}
          onDelete={deleteSelection}
          scale={width / displayWidth}
        />
      </svg>
    </div>
  );
}
