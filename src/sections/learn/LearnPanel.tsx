// Zweite Seitenleiste im Lern-Bereich: Übersicht, heute lernen, abfragen, Karteikarten-Stapel, Mindmaps.
import { Layers, LayoutGrid, MessageCircleQuestionMark, Network, Plus, Sun } from "lucide-react";

import { isDue } from "../../learning/srs";
import type { SectionProps } from "../types";
import { NEW_DECK_NAME } from "./DeckView";
import { useLearn } from "./LearnContext";
import { NEW_MINDMAP_TITLE } from "./MindmapView";
import { deckSelection, mindmapSelection, parseLearnSelection } from "./selection";

export function LearnPanel({ selectedId, onSelect }: SectionProps) {
  const { decks, cards, addDeck, mindmaps, addMindmap } = useLearn();
  const selection = parseLearnSelection(selectedId);
  const dueOf = (deckId?: string) => cards.filter((c) => (!deckId || c.deckId === deckId) && isDue(c)).length;
  const totalDue = dueOf();

  return (
    <>
      <nav className="panel-list">
        <button className={`panel-item ${selection.kind === "overview" ? "active" : ""}`} onClick={() => onSelect(null)}>
          <LayoutGrid size={15} className="panel-item-icon" />
          <span className="panel-item-label">Übersicht</span>
        </button>
        <button className={`panel-item ${selection.kind === "today" ? "active" : ""}`} onClick={() => onSelect("today")}>
          <Sun size={15} className="panel-item-icon" />
          <span className="panel-item-label">Heute lernen</span>
          {totalDue ? <span className="panel-item-count">{totalDue}</span> : null}
        </button>
        <button className={`panel-item ${selection.kind === "quiz" ? "active" : ""}`} onClick={() => onSelect("quiz")}>
          <MessageCircleQuestionMark size={15} className="panel-item-icon" />
          <span className="panel-item-label">Abfragen</span>
        </button>

        <div className="panel-section-title">Karteikarten</div>
        {decks.length === 0 && <p className="panel-hint">Noch keine Stapel.</p>}
        {[...decks]
          .sort((a, b) => a.name.localeCompare(b.name, "de"))
          .map((deck) => (
            <button
              key={deck.id}
              className={`panel-item ${selection.kind === "deck" && selection.id === deck.id ? "active" : ""}`}
              onClick={() => onSelect(deckSelection(deck.id))}
            >
              <Layers size={15} className="panel-item-icon" />
              <span className="panel-item-label">{deck.name || "Ohne Namen"}</span>
              {dueOf(deck.id) ? <span className="panel-item-count">{dueOf(deck.id)}</span> : null}
            </button>
          ))}

        <div className="panel-section-title">Mindmaps</div>
        {mindmaps.length === 0 && <p className="panel-hint">Noch keine Mindmaps.</p>}
        {[...mindmaps]
          .sort((a, b) => a.title.localeCompare(b.title, "de"))
          .map((map) => (
            <button
              key={map.id}
              className={`panel-item ${selection.kind === "mindmap" && selection.id === map.id ? "active" : ""}`}
              onClick={() => onSelect(mindmapSelection(map.id))}
            >
              <Network size={15} className="panel-item-icon" />
              <span className="panel-item-label">{map.title || "Ohne Titel"}</span>
            </button>
          ))}
      </nav>
      <button className="panel-add-button" onClick={() => onSelect(deckSelection(addDeck(NEW_DECK_NAME)))}>
        <Plus size={15} /> Neuer Stapel
      </button>
      <button className="panel-add-button" onClick={() => onSelect(mindmapSelection(addMindmap(NEW_MINDMAP_TITLE)))}>
        <Plus size={15} /> Neue Mindmap
      </button>
    </>
  );
}
