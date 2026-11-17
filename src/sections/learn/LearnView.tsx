// Hauptansicht im Lern-Bereich: Übersicht, heute lernen, ein Stapel oder einen Stapel lernen.
import { Layers, Plus, Sun } from "lucide-react";

import { isDue, isKnown } from "../../learning/srs";
import { useNotes } from "../notes/NotesContext";
import type { SectionProps } from "../types";
import { CardTrainer } from "./CardTrainer";
import { DeckView, NEW_DECK_NAME } from "./DeckView";
import { QuizView } from "./QuizView";
import { useLearn } from "./LearnContext";
import { deckSelection, parseLearnSelection } from "./selection";

export function LearnView({ selectedId, onSelect }: SectionProps) {
  const { decks, cards } = useLearn();
  const selection = parseLearnSelection(selectedId);

  let title = "Lernen";
  let content;
  if (selection.kind === "today") {
    title = "Heute lernen";
    content = <CardTrainer cards={cards} showDeck onBack={() => onSelect(null)} />;
  } else if (selection.kind === "quiz") {
    title = "Abfragen";
    content = <QuizView />;
  } else if (selection.kind === "deck") {
    const deck = decks.find((d) => d.id === selection.id);
    if (!deck) {
      content = <p className="muted">Dieser Stapel wurde gelöscht.</p>;
    } else if (selection.learning) {
      title = deck.name || "Ohne Namen";
      content = <CardTrainer cards={cards.filter((c) => c.deckId === deck.id)} onBack={() => onSelect(deckSelection(deck.id))} />;
    } else {
      title = "Karteikarten";
      content = <DeckView deck={deck} onLearn={() => onSelect(deckSelection(deck.id, true))} onDeleted={() => onSelect(null)} />;
    }
  } else {
    content = <Overview onSelect={onSelect} />;
  }

  return (
    <div className="english">
      {/* key: beim Wechsel des Stapels alles neu aufbauen (Formulare, Vorschau) */}
      <div className="english-inner" key={selectedId ?? "overview"}>
        <h1 className="browser-title">{title}</h1>
        {content}
      </div>
    </div>
  );
}

function Overview({ onSelect }: { onSelect: (id: string | null) => void }) {
  const { decks, cards, addDeck } = useLearn();
  const { subjects } = useNotes();
  const due = cards.filter((c) => isDue(c)).length;
  const known = cards.filter(isKnown).length;
  const folderName = (id: string | null | undefined) => subjects.find((s) => s.id === id)?.name;

  return (
    <div className="english-overview">
      <div className="english-stats">
        <button className="english-stat" onClick={() => onSelect("today")} disabled={!due}>
          <strong>{due}</strong>
          <span>Karten heute fällig</span>
        </button>
        <div className="english-stat">
          <strong>{cards.length}</strong>
          <span>Karten insgesamt</span>
        </div>
        <div className="english-stat">
          <strong>{known}</strong>
          <span>sicher gelernt</span>
        </div>
      </div>
      {due > 0 && (
        <button className="primary-button learn-today" onClick={() => onSelect("today")}>
          <Sun size={15} /> Jetzt {due} Karten lernen
        </button>
      )}

      <h2 className="deck-list-title">Karteikarten-Stapel</h2>
      <div className="project-grid">
        {decks.map((deck) => {
          const deckCards = cards.filter((c) => c.deckId === deck.id);
          const deckDue = deckCards.filter((c) => isDue(c)).length;
          return (
            <button key={deck.id} className="project-card" onClick={() => onSelect(deckSelection(deck.id))}>
              <div className="project-card-top">
                <Layers size={14} />
                {folderName(deck.folderId) && <span className="muted">{folderName(deck.folderId)}</span>}
              </div>
              <h3>{deck.name || "Ohne Namen"}</h3>
              <div className="project-card-bottom muted">
                {deckCards.length} Karten · {deckDue ? `${deckDue} fällig` : "nichts fällig"}
              </div>
            </button>
          );
        })}
        <button className="project-card new-deck" onClick={() => onSelect(deckSelection(addDeck(NEW_DECK_NAME)))}>
          <Plus size={18} />
          <span>Neuer Stapel</span>
        </button>
      </div>
    </div>
  );
}
