// Zeigt ein PDF: Kopfzeile (Name, Favorit), alle Seiten untereinander, Stift-Werkzeuge.
import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";

import { DrawingToolbar } from "../../drawing/DrawingToolbar";
import { PEN_COLORS, type Stroke, type Tool } from "../../drawing/strokes";
import { usePenShortcuts } from "../../drawing/useStrokeInput";
import { loadPdfFile, loadPdfInk, savePdfInk, type PdfDoc, type PdfInk } from "../../storage/db";
import { publish, useLiveSync } from "../../storage/liveSync";
import { getDocument, type PDFDocumentProxy } from "./pdfjs";
import { PdfPage } from "./PdfPage";
import { usePdfs } from "./PdfsContext";

const MAX_PAGE_WIDTH = 900;

type Loaded = {
  doc: PDFDocumentProxy;
  sizes: [number, number][]; // Größe jeder Seite in PDF-Einheiten
};

export function PdfViewer({ pdf }: { pdf: PdfDoc }) {
  const { updatePdf } = usePdfs();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ink, setInk] = useState<PdfInk>({});
  const [history, setHistory] = useState<PdfInk[]>([]); // für "Rückgängig"

  const [penMode, setPenMode] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(PEN_COLORS[0]);

  // Verfügbare Breite messen, damit die Seiten hineinpassen.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  useEffect(() => {
    const element = scrollRef.current!;
    const observer = new ResizeObserver(() => setAvailableWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const displayWidth = Math.min(availableWidth - 48, MAX_PAGE_WIDTH);

  // PDF-Datei und Zeichnungen laden.
  useEffect(() => {
    let task: ReturnType<typeof getDocument> | null = null;
    let cancelled = false;

    (async () => {
      try {
        const [file, storedInk] = await Promise.all([loadPdfFile(pdf.id), loadPdfInk(pdf.id)]);
        if (!file) throw new Error("Datei nicht gefunden");
        task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
        const doc = await task.promise;
        const sizes = await Promise.all(
          Array.from({ length: doc.numPages }, async (_, i) => {
            const viewport = (await doc.getPage(i + 1)).getViewport({ scale: 1 });
            return [viewport.width, viewport.height] as [number, number];
          }),
        );
        if (cancelled) return;
        setInk(storedInk);
        setLoaded({ doc, sizes });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      task?.destroy(); // PDF schließen und Speicher freigeben
    };
  }, [pdf.id]);

  // ---------- Zeichnungen ändern + speichern ----------
  // Ist dieselbe PDF im Split-Modus zweimal offen, gleichen sich beide live ab.
  const inkSyncId = useLiveSync<PdfInk>(`pdf-ink:${pdf.id}`, setInk);

  const save = (next: PdfInk) => {
    setInk(next);
    savePdfInk(pdf.id, next);
    publish(`pdf-ink:${pdf.id}`, inkSyncId, next);
  };

  const withPage = (index: number, strokes: Stroke[]) => ({ ...ink, [index]: strokes });

  const undo = () => {
    if (history.length === 0) return;
    save(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  };

  usePenShortcuts(penMode, () => setPenMode(false), undo);

  return (
    <div className="pdf-viewer">
      <header className="pdf-header">
        <input
          className="pdf-name-input"
          value={pdf.name}
          onChange={(e) => updatePdf(pdf.id, { name: e.target.value })}
        />
        <button
          className={`icon-button ${pdf.favorite ? "favorite" : ""}`}
          onClick={() => updatePdf(pdf.id, { favorite: !pdf.favorite })}
          title={pdf.favorite ? "Aus Favoriten entfernen" : "Zu Favoriten"}
        >
          <Star size={18} fill={pdf.favorite ? "currentColor" : "none"} />
        </button>
        {loaded && <span className="pdf-page-count">{loaded.sizes.length} Seiten</span>}
      </header>

      <div className="pdf-scroll" ref={scrollRef}>
        {error && <p className="pdf-error">PDF konnte nicht geöffnet werden: {error}</p>}
        {loaded &&
          displayWidth > 0 &&
          loaded.sizes.map((size, index) => (
            <PdfPage
              key={index}
              doc={loaded.doc}
              index={index}
              size={size}
              displayWidth={displayWidth}
              strokes={ink[index] ?? []}
              penMode={penMode}
              tool={tool}
              color={color}
              onCommit={(strokes) => {
                setHistory([...history, ink]);
                save(withPage(index, strokes));
              }}
              onErase={(strokes) => save(withPage(index, strokes))}
              onEraseDone={(before) => setHistory([...history, withPage(index, before)])}
            />
          ))}
      </div>

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
