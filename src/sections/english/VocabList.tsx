// Alle Vokabeln: suchen, eigene Wörter hinzufügen, löschen.
import { useState } from "react";
import { Plus, X } from "lucide-react";

import { useEnglish } from "./EnglishContext";
import { SpeakButton } from "./VocabTrainer";

export function VocabList() {
  const { english, cards, addCard, deleteCard } = useEnglish();
  const [query, setQuery] = useState("");
  const [en, setEn] = useState("");
  const [de, setDe] = useState("");
  const [example, setExample] = useState("");

  const unitName = (unitId: string | null) =>
    unitId ? (english?.units.find((u) => u.id === unitId)?.title ?? "") : "Eigene";
  const q = query.trim().toLowerCase();
  const visible = cards
    .filter((c) => !q || c.en.toLowerCase().includes(q) || c.de.toLowerCase().includes(q))
    .sort((a, b) => a.en.localeCompare(b.en, "en"));

  const status = (c: (typeof cards)[number]) =>
    c.due === null ? "gesperrt" : c.reps >= 2 ? "sicher" : c.reps > 0 ? "am Lernen" : "neu";

  return (
    <div className="english-card wide">
      <form
        className="english-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!en.trim() || !de.trim()) return;
          addCard(en.trim(), de.trim(), example.trim());
          setEn("");
          setDe("");
          setExample("");
        }}
      >
        <input value={en} onChange={(e) => setEn(e.target.value)} placeholder="Englisch" lang="en" />
        <input value={de} onChange={(e) => setDe(e.target.value)} placeholder="Deutsch" />
        <input value={example} onChange={(e) => setExample(e.target.value)} placeholder="Beispielsatz (optional)" lang="en" />
        <button className="primary-button" type="submit" disabled={!en.trim() || !de.trim()}>
          <Plus size={15} /> Hinzufügen
        </button>
      </form>

      <input className="english-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`In ${cards.length} Vokabeln suchen …`} />

      <div className="english-table">
        {visible.map((c) => (
          <div key={c.id} className="english-row">
            <span className="english-row-en">
              {c.en} <SpeakButton text={c.en} />
            </span>
            <span>{c.de}</span>
            <span className="muted english-row-unit">{unitName(c.unitId)}</span>
            <span className={`english-status ${status(c).replace(" ", "-")}`}>{status(c)}</span>
            <button
              className="icon-button"
              title="Löschen"
              onClick={() => window.confirm(`„${c.en}“ löschen?`) && deleteCard(c.id)}
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {visible.length === 0 && <p className="muted">Keine Vokabeln gefunden.</p>}
      </div>
    </div>
  );
}
