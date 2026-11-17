// Gemeinsamer Zustand des Lern-Bereichs: Karteikarten-Stapel und Karten.
import { createContext, useContext } from "react";

import type { Rating } from "../../learning/srs";
import type { Flashcard, FlashcardDeck } from "../../storage/db";

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
};

export const LearnContext = createContext<LearnState | null>(null);

export function useLearn(): LearnState {
  const value = useContext(LearnContext);
  if (!value) throw new Error("useLearn muss innerhalb von <LearnProvider> benutzt werden");
  return value;
}
