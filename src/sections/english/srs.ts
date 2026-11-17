// Lernlogik für Vokabeln. Die eigentliche Wiederholung nach Lernstand steht in src/learning/srs.ts
// (gilt auch für Karteikarten) – hier nur das Vokabel-Spezifische.
import { freshSchedule } from "../../learning/srs";
import type { VocabCard } from "../../storage/db";

export { isDue, nextIntervalLabel, review, type Rating } from "../../learning/srs";

export function newCard(fields: Pick<VocabCard, "en" | "de" | "example" | "unitId">, unlocked: boolean): VocabCard {
  return { id: crypto.randomUUID(), ...fields, ...freshSchedule(unlocked), createdAt: Date.now() };
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
