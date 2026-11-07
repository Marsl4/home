// Vokabeln lernen: Karte ansehen, Antwort überlegen, umdrehen, ehrlich bewerten.
// Abwechselnd Deutsch → Englisch und Englisch → Deutsch. Lautsprecher = Aussprache vorlesen.
// Tastatur: Leertaste = umdrehen, 1–4 = bewerten.
import { useEffect, useState } from "react";
import { PartyPopper, Volume2 } from "lucide-react";

import type { VocabCard } from "../../storage/db";
import { useEnglish } from "./EnglishContext";
import { isDue, nextIntervalLabel, speak, type Rating } from "./srs";

const RATINGS: { rating: Rating; label: string; key: string }[] = [
  { rating: "again", label: "Nochmal", key: "1" },
  { rating: "hard", label: "Schwer", key: "2" },
  { rating: "good", label: "Gut", key: "3" },
  { rating: "easy", label: "Leicht", key: "4" },
];

// Richtung pro Karte und Wiederholung (gleichmäßig verteilt, aber bei derselben Karte stabil).
const germanFirst = (card: VocabCard) => (card.id.charCodeAt(0) + card.reps + card.lapses) % 2 === 0;

export function VocabTrainer() {
  const { cards, reviewCard } = useEnglish();
  const [flipped, setFlipped] = useState(false);
  const [doneToday, setDoneToday] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Jede halbe Minute neu schauen, ob "Nochmal"-Karten wieder dran sind.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const due = cards.filter((c) => isDue(c, now)).sort((a, b) => (a.due ?? 0) - (b.due ?? 0));
  const card = due[0];
  const upcoming = cards.filter((c) => c.due !== null && !isDue(c, now)).sort((a, b) => (a.due ?? 0) - (b.due ?? 0));

  const rate = (rating: Rating) => {
    if (!card) return;
    reviewCard(card.id, rating);
    setFlipped(false);
    setDoneToday((n) => n + 1);
    setNow(Date.now());
  };

  // Tastatur (am Mac)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA"].includes(target.tagName) || !card) return;
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
    const next = upcoming[0];
    return (
      <div className="english-card center">
        <PartyPopper size={32} />
        <h2>{doneToday ? `Super – ${doneToday} Karten gelernt!` : "Gerade ist nichts fällig."}</h2>
        <p className="muted">
          {next
            ? `Nächste Wiederholung: ${new Date(next.due!).toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" })}`
            : cards.length
              ? "Schließe im Lernplan die aktuelle Einheit ab, um neue Vokabeln freizuschalten."
              : "Noch keine Vokabeln – mach zuerst den Einstufungstest oder füge eigene Wörter hinzu."}
        </p>
      </div>
    );
  }

  const deFirst = germanFirst(card);
  const front = deFirst ? card.de : card.en;
  return (
    <div className="english-card">
      <p className="muted">
        Noch {due.length} fällig · {deFirst ? "Wie heißt das auf Englisch?" : "Was bedeutet das?"}
      </p>
      <div className={`vocab-card ${flipped ? "flipped" : ""}`} onClick={() => setFlipped(true)}>
        <div className="vocab-front">
          {front}
          {!deFirst && <SpeakButton text={card.en} />}
        </div>
        {flipped && (
          <div className="vocab-back">
            <div className="vocab-answer">
              {deFirst ? card.en : card.de}
              {deFirst && <SpeakButton text={card.en} />}
            </div>
            {card.example && (
              <div className="vocab-example">
                „{card.example}“
                <SpeakButton text={card.example} />
              </div>
            )}
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

export function SpeakButton({ text }: { text: string }) {
  return (
    <button
      className="icon-button speak-button"
      title="Vorlesen"
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
    >
      <Volume2 size={18} />
    </button>
  );
}
