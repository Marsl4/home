// Eine einzelne PDF-Seite: das gerenderte Bild + eine Zeichenschicht darüber.
// Die Seite wird erst gerendert, wenn sie in die Nähe des sichtbaren Bereichs kommt (spart Zeit bei langen PDFs).
import { useEffect, useMemo, useRef, useState } from "react";

import { strokeToPath, type Stroke, type Tool } from "../../drawing/strokes";
import { LassoOverlay } from "../../drawing/LassoOverlay";
import { boundsOfPolygon, captureRegion, copySnipToClipboard } from "../../drawing/snip";
import { useStrokeInput } from "../../drawing/useStrokeInput";
import { RenderingCancelledException, type PDFDocumentProxy } from "./pdfjs";

type Props = {
  doc: PDFDocumentProxy;
  index: number; // Seitennummer ab 0
  size: [number, number]; // Breite/Höhe in PDF-Einheiten
  displayWidth: number; // angezeigte Breite in Pixeln
  strokes: Stroke[];
  penMode: boolean;
  tool: Tool;
  color: string;
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

  // Erst rendern, wenn die Seite fast sichtbar ist.
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setNearViewport(true),
      { rootMargin: "1200px 0px" },
    );
    observer.observe(wrapperRef.current!);
    return () => observer.disconnect();
  }, []);

  // PDF-Seite ins Canvas zeichnen (scharf auch auf Retina-Bildschirmen).
  useEffect(() => {
    if (!nearViewport || displayWidth <= 0) return;
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | null = null;
    let cancelled = false;

    doc.getPage(index + 1).then((page) => {
      if (cancelled) return;
      const scale = (displayWidth / width) * window.devicePixelRatio;
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
  }, [doc, index, width, displayWidth, nearViewport]);

  // Zeichnen: Koordinaten in PDF-Einheiten, damit Striche beim Zoomen mitskalieren.
  const { draft, handlers, lasso, selection, selectionBox, deleteSelection, dragOffset } =
    useStrokeInput({
    enabled: penMode,
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
    onSnip: (polygon) => {
      // PDF-Einheiten -> Pixel der angezeigten Seite
      const scale = displayWidth / width;
      const box = boundsOfPolygon(polygon);
      copySnipToClipboard(
        captureRegion(wrapperRef.current!, {
          x: box.x * scale,
          y: box.y * scale,
          width: box.width * scale,
          height: box.height * scale,
        }),
      );
    },
  });

  const paths = useMemo(() => new Map(strokes.map((s) => [s.id, strokeToPath(s)])), [strokes]);

  const renderStroke = (stroke: Stroke, path: string) => {
    const isSelected = selection.has(stroke.id);
    const classes = [stroke.tool === "highlighter" ? "highlighter-stroke" : "", isSelected ? "selected" : ""];
    return (
      <path
        key={stroke.id}
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
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className={`pdf-ink ${penMode ? "active" : ""} tool-${tool}`}
        {...handlers}
      >
        {strokes.map((s) => renderStroke(s, paths.get(s.id) ?? ""))}
        {draft && renderStroke(draft, strokeToPath(draft))}
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
