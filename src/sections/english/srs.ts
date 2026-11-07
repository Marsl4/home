// Wiederholung nach Lernstand ("Spaced Repetition", vereinfacht nach dem bekannten SM-2-Verfahren):
// Was du gut kannst, kommt in immer größeren Abständen wieder – was du nicht wusstest, gleich nochmal.
import type { VocabCard } from "../../storage/db";

export type Rating = "again" | "hard" | "good" | "easy";

const DAY = 24 * 60 * 60 * 1000;

export function newCard(fields: Pick<VocabCard, "en" | "de" | "example" | "unitId">, unlocked: boolean): VocabCard {
  return {
    id: crypto.randomUUID(),
    ...fields,
    due: unlocked ? Date.now() : null,
    interval: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    createdAt: Date.now(),
  };
}

export function review(card: VocabCard, rating: Rating, now = Date.now()): VocabCard {
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

export const isDue = (card: VocabCard, now = Date.now()) => card.due !== null && card.due <= now;

// Text für die Bewertungs-Knöpfe: wann käme die Karte wieder?
export function nextIntervalLabel(card: VocabCard, rating: Rating): string {
  const next = review(card, rating, 0);
  const ms = next.due ?? 0;
  if (ms < DAY) return "< 1 Min.";
  const days = Math.round(ms / DAY);
  return days === 1 ? "1 Tag" : days < 30 ? `${days} Tage` : `${Math.round(days / 30)} Mon.`;
}

// Englisch vorlesen (Stimme des Geräts – funktioniert auch offline).
export function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang === "en-GB") ??
    window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("en"));
  if (voice) utterance.voice = voice;
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}
