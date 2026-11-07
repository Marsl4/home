// Zweite Seitenleiste im PDF-Bereich: Filter (Alle/Zuletzt/Favoriten), Liste, Import.
import { FileText, Star, Upload, X } from "lucide-react";

import { usePersistentState } from "../../storage/uiState";
import type { SectionProps } from "../types";
import { ImportPdfButton } from "./ImportPdfButton";
import { filterPdfs, PDF_FILTERS, usePdfs, type PdfFilter } from "./PdfsContext";

export function PdfsPanel({ selectedId, onSelect }: SectionProps) {
  const { pdfs, updatePdf, deletePdf } = usePdfs();
  const [filter, setFilter] = usePersistentState<PdfFilter>("ui:pdfFilter", "all");
  const visible = filterPdfs(pdfs, filter);

  const open = (id: string) => {
    updatePdf(id, { lastOpenedAt: Date.now() });
    onSelect(id);
  };

  const remove = (id: string, name: string) => {
    if (!window.confirm(`PDF "${name}" samt Notizen darauf wirklich löschen?`)) return;
    deletePdf(id);
    if (id === selectedId) onSelect(null);
  };

  return (
    <>
      <div className="segmented">
        {PDF_FILTERS.map((f) => (
          <button
            key={f.id}
            className={f.id === filter ? "selected" : undefined}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <nav className="panel-list">
        {visible.length === 0 && (
          <p className="panel-hint">
            {filter === "favorites"
              ? "Noch keine Favoriten. Markiere ein PDF mit dem Stern."
              : filter === "recent"
                ? "Noch nichts geöffnet."
                : "Noch keine PDFs importiert."}
          </p>
        )}
        {visible.map((pdf) => (
          <div
            key={pdf.id}
            className={`panel-item ${pdf.id === selectedId ? "active" : ""}`}
            onClick={() => open(pdf.id)}
          >
            <FileText size={15} className="panel-item-icon" />
            <span className="panel-item-label">{pdf.name || "Ohne Namen"}</span>
            {pdf.favorite && <Star size={12} className="panel-item-star" fill="currentColor" />}
            <button
              className="panel-item-action"
              title="PDF löschen"
              onClick={(e) => {
                e.stopPropagation();
                remove(pdf.id, pdf.name);
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </nav>

      <ImportPdfButton
        className="panel-add-button"
        onImported={(added) => added[0] && open(added[0].id)}
      >
        <Upload size={15} /> PDF importieren
      </ImportPdfButton>
    </>
  );
}
