// Wiederholung nach Lernstand ("Spaced Repetition", vereinfacht nach dem bekannten SM-2-Verfahren):
// Was du gut kannst, kommt in immer größeren Abständen wieder – was du nicht wusstest, gleich nochmal.
// Gilt für alles, was man abfragt: Englisch-Vokabeln und Karteikarten.

export type Rating = "again" | "hard" | "good" | "easy";

// Lernstand einer Karte (egal ob Vokabel oder Karteikarte).
export type Scheduled = {
  due: number | null; // wann wieder dran; null = noch gesperrt
  interval: number; // Abstand in Tagen
  ease: number; // wie leicht die Karte fällt (Faktor)
  reps: number; // wie oft hintereinander gewusst
  lapses: number; // wie oft vergessen
};

const DAY = 24 * 60 * 60 * 1000;

// Lernstand einer neuen Karte.
export function freshSchedule(unlocked: boolean): Scheduled {
  return { due: unlocked ? Date.now() : null, interval: 0, ease: 2.5, reps: 0, lapses: 0 };
}

export function review<T extends Scheduled>(card: T, rating: Rating, now = Date.now()): T {
  if (rating === "again") {
    // Nicht gewusst: in 1 Minute nochmal (in dieser Lernrunde), Abstand von vorn.
    return { ...card, reps: 0, lapses: card.lapses + 1, interval: 0, ease: Math.max(1.3, card.ease - 0.2), due: now + 60_000 };
  }
  const ease = Math.max(1.3, card.ease + (rating === "hard" ? -0.15 : rating === "easy" ? 0.15 : 0));
  let interval: number;
  if (card.reps === 0) interval = rating === "easy" ? 3 : 1;
  else if (card.reps === 1) interval = rating === "hard" ? 2 : rating === "easy" ? 5 : 3;
  else interval = card.interval * (rating === "hard" ? 1.2 : rating === "easy" ? ease * 1.3 : ease);
  interval = Math.round(interval * 10) / 10;
  return { ...card, reps: card.reps + 1, interval, ease, due: now + interval * DAY };
}

export const isDue = (card: Scheduled, now = Date.now()) => card.due !== null && card.due <= now;

// "Sicher" = mindestens zweimal hintereinander gewusst.
export const isKnown = (card: Scheduled) => card.reps >= 2;

// Text für die Bewertungs-Knöpfe: wann käme die Karte wieder?
export function nextIntervalLabel(card: Scheduled, rating: Rating): string {
  const next = review(card, rating, 0);
  const ms = next.due ?? 0;
  if (ms < DAY) return "< 1 Min.";
  const days = Math.round(ms / DAY);
  return days === 1 ? "1 Tag" : days < 30 ? `${days} Tage` : `${Math.round(days / 30)} Mon.`;
}

export const RATINGS: { rating: Rating; label: string; key: string }[] = [
  { rating: "again", label: "Nochmal", key: "1" },
  { rating: "hard", label: "Schwer", key: "2" },
  { rating: "good", label: "Gut", key: "3" },
  { rating: "easy", label: "Leicht", key: "4" },
];
