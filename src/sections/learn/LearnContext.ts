// Gemeinsamer Zustand des Lern-Bereichs: Karteikarten-Stapel und Karten, Liste der Mindmaps.
// (Die Knoten einer Mindmap lädt und speichert die Mindmap-Ansicht selbst.)
import { createContext, useContext } from "react";

import type { Rating } from "../../learning/srs";
import type { Flashcard, FlashcardDeck, Mindmap } from "../../storage/db";

export type NewCard = { front: string; back: string };

export type LearnState = {
  decks: FlashcardDeck[];
  cards: Flashcard[];
  addDeck: (name: string, folderId?: string | null) => string; // gibt die ID zurück
  updateDeck: (id: string, changes: Partial<Omit<FlashcardDeck, "id">>) => void;
  deleteDeck: (id: string) => void; // löscht auch die Karten des Stapels
  addCards: (deckId: string, cards: NewCard[]) => void;
  updateCard: (id: string, changes: Partial<NewCard>) => void;
  deleteCard: (id: string) => void;
  reviewCard: (id: string, rating: Rating) => void;
  mindmaps: Mindmap[];
  addMindmap: (title: string, folderId?: string | null) => string;
  updateMindmap: (id: string, changes: Partial<Omit<Mindmap, "id">>) => void;
  deleteMindmap: (id: string) => void; // löscht auch die Knoten
};

export const LearnContext = createContext<LearnState | null>(null);

export function useLearn(): LearnState {
  const value = useContext(LearnContext);
  if (!value) throw new Error("useLearn muss innerhalb von <LearnProvider> benutzt werden");
  return value;
}
