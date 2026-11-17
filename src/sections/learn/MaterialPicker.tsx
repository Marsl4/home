// Auswahl des Lernmaterials für die KI: eine Notiz, ein PDF (mit Seitenbereich) oder eigener Text.
// Gehört der Stapel zu einem Fach (Uni-Ordner), stehen dessen Notizen und PDFs oben.
import { useEffect, useRef, useState } from "react";

import { pdfPageCount } from "../../ai/context";
import { useNotes } from "../notes/NotesContext";
import { usePdfs } from "../pdfs/PdfsContext";
import { descendantIds } from "../uni/folders";
import type { Material } from "./learnAi";

type Choice = { key: string; label: string; material: Material };

export function MaterialPicker({ folderId, onChange }: { folderId: string | null; onChange: (m: Material | null) => void }) {
  const { pages, subjects } = useNotes();
  const { pdfs } = usePdfs();
  const [key, setKey] = useState("");
  const [text, setText] = useState("");
  const [range, setRange] = useState({ from: 1, to: 10 });
  const [pageCount, setPageCount] = useState<number | null>(null);

  // Notizen/PDFs im Fach (inkl. Unterordner) zuerst.
  const inFolder = folderId ? descendantIds(subjects, folderId).add(folderId) : new Set<string>();
  const note = (p: (typeof pages)[number]): Choice => ({
    key: `note:${p.id}`,
    label: `📝 ${p.title || "Ohne Titel"}`,
    material: { kind: "source", source: { kind: "note", id: p.id, title: p.title || "Ohne Titel" } },
  });
  const pdf = (d: (typeof pdfs)[number]): Choice => ({
    key: `pdf:${d.id}`,
    label: `📄 ${d.name}`,
    material: { kind: "source", source: { kind: "pdf", id: d.id, title: d.name } },
  });
  const folderChoices = [
    ...pages.filter((p) => p.subjectId && inFolder.has(p.subjectId)).map(note),
    ...pdfs.filter((d) => d.folderId && inFolder.has(d.folderId)).map(pdf),
  ];
  const otherNotes = pages.filter((p) => !(p.subjectId && inFolder.has(p.subjectId))).map(note);
  const otherPdfs = pdfs.filter((d) => !(d.folderId && inFolder.has(d.folderId))).map(pdf);
  const all = [...folderChoices, ...otherNotes, ...otherPdfs];
  const isPdf = key.startsWith("pdf:");

  // Die aktuelle Auswahl nach außen melden (bei jeder Änderung).
  const report = (next: { key?: string; text?: string; range?: { from: number; to: number } }) => {
    const k = next.key ?? key;
    const t = next.text ?? text;
    const r = next.range ?? range;
    const choice = all.find((c) => c.key === k);
    if (k === "text") onChange(t.trim() ? { kind: "text", text: t } : null);
    else if (choice?.material.kind === "source") onChange(k.startsWith("pdf:") ? { ...choice.material, range: r } : choice.material);
    else onChange(null);
  };

  const choose = (k: string) => {
    setKey(k);
    report({ key: k });
  };
  const changeRange = (r: { from: number; to: number }) => {
    setRange(r);
    report({ range: r });
  };

  // Bei PDFs: Seitenzahl holen und Bereich vorschlagen (kleine PDFs ganz, sonst die ersten 10 Seiten).
  const reportRef = useRef(report);
  useEffect(() => {
    reportRef.current = report;
  });
  useEffect(() => {
    if (!isPdf) return;
    let cancelled = false;
    pdfPageCount(key.slice(4)).then((count) => {
      if (cancelled) return;
      const suggested = { from: 1, to: Math.max(1, Math.min(count, 10)) };
      setPageCount(count);
      setRange(suggested);
      reportRef.current({ range: suggested });
    });
    return () => {
      cancelled = true;
    };
  }, [key, isPdf]);

  return (
    <div className="material-picker">
      <select className="ai-model-select material-select" value={key} onChange={(e) => choose(e.target.value)}>
        <option value="">Material wählen …</option>
        {folderChoices.length > 0 && (
          <optgroup label="Aus diesem Fach">
            {folderChoices.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </optgroup>
        )}
        {otherNotes.length > 0 && (
          <optgroup label={folderChoices.length ? "Weitere Notizen" : "Notizen"}>
            {otherNotes.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </optgroup>
        )}
        {otherPdfs.length > 0 && (
          <optgroup label={folderChoices.length ? "Weitere PDFs" : "PDFs"}>
            {otherPdfs.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </optgroup>
        )}
        <option value="text">✏️ Eigenen Text einfügen</option>
      </select>

      {isPdf && (
        <div className="material-range">
          Seiten
          <input
            type="number"
            min={1}
            max={pageCount ?? undefined}
            value={range.from}
            onChange={(e) => changeRange({ ...range, from: Math.max(1, Number(e.target.value) || 1) })}
          />
          bis
          <input
            type="number"
            min={range.from}
            max={pageCount ?? undefined}
            value={range.to}
            onChange={(e) => changeRange({ ...range, to: Math.max(range.from, Number(e.target.value) || range.from) })}
          />
          {pageCount !== null && <span className="muted">von {pageCount}</span>}
        </div>
      )}

      {key === "text" && (
        <textarea
          className="material-text"
          placeholder="Text hier einfügen (z. B. aus einem Skript)"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            report({ text: e.target.value });
          }}
          rows={6}
        />
      )}
    </div>
  );
}
