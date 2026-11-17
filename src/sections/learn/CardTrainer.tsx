// Karteikarten lernen: Frage ansehen, Antwort überlegen, umdrehen, ehrlich bewerten.
// Tastatur (nur in der aktiven Hälfte): Leertaste = umdrehen, 1–4 = bewerten.
import { useEffect, useState } from "react";
import { PartyPopper } from "lucide-react";

import { AiMarkdown } from "../../ai/AiMarkdown";
import { usePaneFocused } from "../../components/PaneContext";
import { isDue, nextIntervalLabel, RATINGS, type Rating } from "../../learning/srs";
import type { Flashcard } from "../../storage/db";
import { useLearn } from "./LearnContext";

// cards: aus welchen Karten gelernt wird (ein Stapel oder alle). showDeck: Stapelnamen über der Karte zeigen.
export function CardTrainer({ cards, showDeck, onBack }: { cards: Flashcard[]; showDeck?: boolean; onBack: () => void }) {
  const { decks, reviewCard } = useLearn();
  const focused = usePaneFocused();
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Jede halbe Minute schauen, ob "Nochmal"-Karten wieder dran sind.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const due = cards.filter((c) => isDue(c, now)).sort((a, b) => (a.due ?? 0) - (b.due ?? 0));
  const card = due[0];

  const rate = (rating: Rating) => {
    if (!card) return;
    reviewCard(card.id, rating);
    setFlipped(false);
    setDone((n) => n + 1);
    setNow(Date.now());
  };

  useEffect(() => {
    if (!focused) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable || !card) return;
      if (event.key === " ") {
        event.preventDefault();
        setFlipped(true);
      }
      const r = RATINGS.find((x) => x.key === event.key);
      if (r && flipped) rate(r.rating);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!card) {
    const next = cards.filter((c) => c.due !== null && !isDue(c, now)).sort((a, b) => (a.due ?? 0) - (b.due ?? 0))[0];
    return (
      <div className="english-card center">
        <PartyPopper size={32} />
        <h2>{done ? `Super – ${done} Karten gelernt!` : "Gerade ist nichts fällig."}</h2>
        <p className="muted">
          {next
            ? `Nächste Wiederholung: ${new Date(next.due!).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
            : cards.length
              ? "Alle Karten sind gelernt."
              : "Noch keine Karten – lege welche an oder lass sie von der KI erstellen."}
        </p>
        <button className="secondary-button" onClick={onBack}>
          Zurück
        </button>
      </div>
    );
  }

  const deck = showDeck ? decks.find((d) => d.id === card.deckId) : undefined;
  return (
    <div className="english-card">
      <p className="muted">
        Noch {due.length} fällig{done ? ` · ${done} geschafft` : ""}
        {deck ? ` · ${deck.name}` : ""}
      </p>
      <div className={`vocab-card flashcard ${flipped ? "flipped" : ""}`} onClick={() => setFlipped(true)}>
        <div className="vocab-front">
          <AiMarkdown text={card.front} />
        </div>
        {flipped && (
          <div className="vocab-back flashcard-back">
            <AiMarkdown text={card.back} />
          </div>
        )}
      </div>
      {flipped ? (
        <div className="vocab-ratings">
          {RATINGS.map(({ rating, label, key }) => (
            <button key={rating} className={`vocab-rating ${rating}`} onClick={() => rate(rating)} title={`Taste ${key}`}>
              <span>{label}</span>
              <small>{nextIntervalLabel(card, rating)}</small>
            </button>
          ))}
        </div>
      ) : (
        <button className="primary-button vocab-flip" onClick={() => setFlipped(true)}>
          Antwort zeigen
        </button>
      )}
    </div>
  );
}
