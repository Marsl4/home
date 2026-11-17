// Ein Karteikarten-Stapel: Name + Fach, Lernstand, Karten hinzufügen (von Hand oder mit KI), Kartenliste.
import { useEffect, useRef, useState } from "react";
import { Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";

import { AiMarkdown } from "../../ai/AiMarkdown";
import { describeAiError, isAiServiceError } from "../../ai/provider";
import { isDue, isKnown } from "../../learning/srs";
import type { Flashcard, FlashcardDeck } from "../../storage/db";
import { useNotes } from "../notes/NotesContext";
import { folderPath } from "../uni/folders";
import { useLearn, type NewCard } from "./LearnContext";
import { createCards, type Material } from "./learnAi";
import { MaterialPicker } from "./MaterialPicker";

export const NEW_DECK_NAME = "Neuer Stapel";

export function DeckView({ deck, onLearn, onDeleted }: { deck: FlashcardDeck; onLearn: () => void; onDeleted: () => void }) {
  const { cards, updateDeck, deleteDeck } = useLearn();
  const { subjects } = useNotes();
  const deckCards = cards.filter((c) => c.deckId === deck.id);
  const due = deckCards.filter((c) => isDue(c)).length;
  const known = deckCards.filter(isKnown).length;
  const [panel, setPanel] = useState<"none" | "add" | "ai">(deckCards.length ? "none" : "ai");

  // Gerade angelegter Stapel: Namen markieren, damit man gleich den richtigen Namen tippen kann.
  const nameRef = useRef<HTMLInputElement>(null);
  const isNew = deck.name === NEW_DECK_NAME && deckCards.length === 0;
  useEffect(() => {
    if (isNew) nameRef.current?.select();
    // nur beim Öffnen des Stapels
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Alle Uni-Ordner mit vollem Pfad ("Semester 7 › Steuerrecht") für die Fach-Auswahl.
  const folderOptions = subjects
    .map((s) => ({ id: s.id, label: folderPath(subjects, s.id).map((f) => f.name || "Ohne Namen").join(" › ") }))
    .sort((a, b) => a.label.localeCompare(b.label, "de"));

  return (
    <>
      <div className="deck-head">
        <input
          ref={nameRef}
          className="deck-name"
          value={deck.name}
          onChange={(e) => updateDeck(deck.id, { name: e.target.value })}
          placeholder="Name des Stapels"
          aria-label="Name des Stapels"
        />
        <button
          className="icon-button"
          title="Stapel löschen"
          onClick={() => {
            const ok = window.confirm(`Stapel „${deck.name || "Ohne Namen"}“ mit ${deckCards.length} Karten löschen?`);
            if (ok) {
              deleteDeck(deck.id);
              onDeleted();
            }
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <label className="deck-folder muted">
        Fach:
        <select value={deck.folderId ?? ""} onChange={(e) => updateDeck(deck.id, { folderId: e.target.value || null })}>
          <option value="">– keins –</option>
          {folderOptions.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      <div className="english-stats">
        <button className="english-stat" onClick={onLearn} disabled={!due}>
          <strong>{due}</strong>
          <span>heute fällig</span>
        </button>
        <div className="english-stat">
          <strong>{deckCards.length}</strong>
          <span>Karten</span>
        </div>
        <div className="english-stat">
          <strong>{known}</strong>
          <span>sicher</span>
        </div>
      </div>

      <div className="deck-actions">
        <button className="primary-button" onClick={onLearn} disabled={!due}>
          {due ? `${due} Karten lernen` : "Gerade nichts fällig"}
        </button>
        <button className={`secondary-button ${panel === "add" ? "active" : ""}`} onClick={() => setPanel(panel === "add" ? "none" : "add")}>
          <Plus size={14} /> Karte hinzufügen
        </button>
        <button className={`secondary-button ${panel === "ai" ? "active" : ""}`} onClick={() => setPanel(panel === "ai" ? "none" : "ai")}>
          <Sparkles size={14} /> Mit KI erstellen
        </button>
      </div>

      {panel === "add" && <AddCard deckId={deck.id} />}
      {panel === "ai" && <AiCards deck={deck} onDone={() => setPanel("none")} />}

      <h2 className="deck-list-title">Karten</h2>
      {deckCards.length === 0 ? (
        <p className="muted">Noch keine Karten in diesem Stapel.</p>
      ) : (
        <div className="deck-cards">
          {deckCards.map((card) => (
            <CardRow key={card.id} card={card} />
          ))}
        </div>
      )}
    </>
  );
}

// ---------- Karte von Hand anlegen ----------
function AddCard({ deckId }: { deckId: string }) {
  const { addCards } = useLearn();
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const frontRef = useRef<HTMLTextAreaElement>(null);
  const add = () => {
    if (!front.trim() || !back.trim()) return;
    addCards(deckId, [{ front, back }]);
    setFront("");
    setBack("");
    frontRef.current?.focus(); // gleich die nächste Karte schreiben
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add();
  };
  return (
    <div className="english-card card-editor">
      <textarea ref={frontRef} placeholder="Vorderseite (Frage / Begriff)" value={front} onChange={(e) => setFront(e.target.value)} onKeyDown={onKey} rows={2} autoFocus />
      <textarea placeholder="Rückseite (Antwort)" value={back} onChange={(e) => setBack(e.target.value)} onKeyDown={onKey} rows={3} />
      <div className="deck-actions">
        <button className="primary-button" onClick={add} disabled={!front.trim() || !back.trim()}>
          Hinzufügen
        </button>
        <span className="muted">⌘ + Enter</span>
      </div>
    </div>
  );
}

// ---------- Karten mit der KI erstellen ----------
const COUNTS = [5, 10, 20];

function AiCards({ deck, onDone }: { deck: FlashcardDeck; onDone: () => void }) {
  const { addCards } = useLearn();
  const [material, setMaterial] = useState<Material | null>(null);
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<(NewCard & { keep: boolean })[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    if (!material) return;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const cards = await createCards(material, count, controller.signal);
      setPreview(cards.map((c) => ({ ...c, keep: true })));
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(isAiServiceError(e) ? describeAiError(e, { withAttachment: false }) : e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <div className="english-card center">
        <Loader2 size={24} className="spin" />
        <p>Die KI erstellt Karteikarten …</p>
        <button className="text-button" onClick={() => abortRef.current?.abort()}>
          Abbrechen
        </button>
      </div>
    );
  }

  if (preview) {
    const kept = preview.filter((c) => c.keep);
    return (
      <div className="english-card">
        <h2>Vorschau – welche Karten übernehmen?</h2>
        <div className="deck-cards">
          {preview.map((card, i) => (
            <label key={i} className={`deck-card preview ${card.keep ? "" : "skipped"}`}>
              <input
                type="checkbox"
                checked={card.keep}
                onChange={() => setPreview(preview.map((c, j) => (j === i ? { ...c, keep: !c.keep } : c)))}
              />
              <div>
                <div className="deck-card-front">
                  <AiMarkdown text={card.front} />
                </div>
                <div className="deck-card-back">
                  <AiMarkdown text={card.back} />
                </div>
              </div>
            </label>
          ))}
        </div>
        <div className="deck-actions">
          <button
            className="primary-button"
            disabled={!kept.length}
            onClick={() => {
              addCards(deck.id, kept);
              setPreview(null);
              onDone();
            }}
          >
            {kept.length} Karten übernehmen
          </button>
          <button className="text-button" onClick={() => setPreview(null)}>
            Verwerfen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="english-card">
      <h2>Karteikarten mit KI erstellen</h2>
      <p className="muted">Wähle eine Notiz, ein PDF oder füge Text ein – die KI macht daraus Karten. Du siehst sie vorher.</p>
      <MaterialPicker folderId={deck.folderId ?? null} onChange={setMaterial} />
      <label className="english-field">
        <span>Wie viele Karten?</span>
        <div className="english-choice">
          {COUNTS.map((n) => (
            <button key={n} className={n === count ? "selected" : ""} onClick={() => setCount(n)}>
              {n}
            </button>
          ))}
        </div>
      </label>
      {error && <p className="settings-status error">{error}</p>}
      <button className="primary-button" onClick={run} disabled={!material}>
        <Sparkles size={15} /> Karten erstellen
      </button>
    </div>
  );
}

// ---------- Eine Karte in der Liste (antippen = bearbeiten) ----------
function CardRow({ card }: { card: Flashcard }) {
  const { updateCard, deleteCard } = useLearn();
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);

  if (editing) {
    const save = () => {
      if (front.trim() && back.trim()) updateCard(card.id, { front: front.trim(), back: back.trim() });
      setEditing(false);
    };
    return (
      <div className="deck-card card-editor">
        <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={2} autoFocus />
        <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={3} />
        <div className="deck-actions">
          <button className="primary-button" onClick={save}>
            Speichern
          </button>
          <button className="text-button" onClick={() => setEditing(false)}>
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="deck-card">
      <div className="deck-card-text">
        <div className="deck-card-front">
          <AiMarkdown text={card.front} />
        </div>
        <div className="deck-card-back">
          <AiMarkdown text={card.back} />
        </div>
      </div>
      <div className="deck-card-tools">
        <span className={`deck-card-state ${isKnown(card) ? "known" : ""}`}>{isKnown(card) ? "sicher" : card.reps ? "lernt" : "neu"}</span>
        <button
          className="icon-button"
          title="Bearbeiten"
          onClick={() => {
            setFront(card.front);
            setBack(card.back);
            setEditing(true);
          }}
        >
          <Pencil size={14} />
        </button>
        <button className="icon-button" title="Karte löschen" onClick={() => window.confirm("Karte löschen?") && deleteCard(card.id)}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
