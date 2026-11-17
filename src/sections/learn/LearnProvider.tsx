// Lädt Stapel und Karteikarten und stellt Funktionen zum Ändern bereit (alles wird sofort gespeichert).
import { useEffect, useState, type ReactNode } from "react";

import { freshSchedule, review } from "../../learning/srs";
import { loadDecks, loadFlashcards, saveDecks, saveFlashcards, type Flashcard, type FlashcardDeck } from "../../storage/db";
import { useLiveSync } from "../../storage/liveSync";
import { LearnContext, type NewCard } from "./LearnContext";

export function LearnProvider({ children }: { children: ReactNode }) {
  const [decks, setDecks] = useState<FlashcardDeck[] | null>(null); // null = lädt noch
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  // Vom anderen Gerät (Sync) geänderte Daten sofort übernehmen.
  useLiveSync<FlashcardDeck[]>("flashcard-decks", setDecks);
  useLiveSync<Flashcard[]>("flashcards", setCards);

  useEffect(() => {
    loadDecks().then(setDecks);
    loadFlashcards().then(setCards);
  }, []);

  if (decks === null || cards === null) return null;

  // Jede Änderung baut auf dem neuesten Stand auf und wird sofort gespeichert.
  const updateDecks = (change: (current: FlashcardDeck[]) => FlashcardDeck[]) =>
    setDecks((current) => {
      const next = change(current ?? []);
      saveDecks(next);
      return next;
    });
  const updateCards = (change: (current: Flashcard[]) => Flashcard[]) =>
    setCards((current) => {
      const next = change(current ?? []);
      saveFlashcards(next);
      return next;
    });

  const value = {
    decks,
    cards,
    addDeck: (name: string, folderId: string | null = null) => {
      const id = crypto.randomUUID();
      updateDecks((current) => [...current, { id, name, folderId, createdAt: Date.now() }]);
      return id;
    },
    updateDeck: (id: string, changes: Partial<Omit<FlashcardDeck, "id">>) =>
      updateDecks((current) => current.map((d) => (d.id === id ? { ...d, ...changes } : d))),
    deleteDeck: (id: string) => {
      updateDecks((current) => current.filter((d) => d.id !== id));
      updateCards((current) => current.filter((c) => c.deckId !== id));
    },
    addCards: (deckId: string, newCards: NewCard[]) =>
      updateCards((current) => [
        ...current,
        ...newCards.map((c) => ({
          id: crypto.randomUUID(),
          deckId,
          front: c.front.trim(),
          back: c.back.trim(),
          ...freshSchedule(true),
          createdAt: Date.now(),
        })),
      ]),
    updateCard: (id: string, changes: Partial<NewCard>) =>
      updateCards((current) => current.map((c) => (c.id === id ? { ...c, ...changes } : c))),
    deleteCard: (id: string) => updateCards((current) => current.filter((c) => c.id !== id)),
    reviewCard: (id: string, rating: Parameters<typeof review>[1]) =>
      updateCards((current) => current.map((c) => (c.id === id ? review(c, rating) : c))),
  };

  return <LearnContext.Provider value={value}>{children}</LearnContext.Provider>;
}
