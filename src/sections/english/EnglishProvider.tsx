// Lädt Profil, Lernplan und Vokabeln und stellt Funktionen zum Ändern bereit (alles wird sofort gespeichert).
import { useEffect, useState, type ReactNode } from "react";

import { loadEnglish, loadVocab, saveEnglish, saveVocab, type EnglishState, type VocabCard } from "../../storage/db";
import { useLiveSync } from "../../storage/liveSync";
import { EnglishContext } from "./EnglishContext";
import { newCard, review } from "./srs";

const EMPTY: EnglishState = {
  goal: "",
  minutesPerDay: 15,
  level: null,
  assessedAt: null,
  summary: "",
  strengths: [],
  weaknesses: [],
  units: [],
  planCreatedAt: null,
};

export function EnglishProvider({ children }: { children: ReactNode }) {
  const [english, setEnglish] = useState<EnglishState | null | undefined>(undefined); // undefined = lädt
  const [cards, setCards] = useState<VocabCard[] | null>(null);
  // Vom anderen Gerät (Sync) geänderte Daten sofort übernehmen.
  useLiveSync<EnglishState>("english", setEnglish);
  useLiveSync<VocabCard[]>("english-vocab", setCards);

  useEffect(() => {
    loadEnglish().then((state) => setEnglish(state ? { ...EMPTY, ...state } : null));
    loadVocab().then(setCards);
  }, []);

  if (english === undefined || cards === null) return null;

  const updateEnglish = (change: (current: EnglishState) => EnglishState) =>
    setEnglish((current) => {
      const next = change({ ...EMPTY, ...(current ?? {}) });
      saveEnglish(next);
      return next;
    });
  const updateCards = (change: (current: VocabCard[]) => VocabCard[]) =>
    setCards((current) => {
      const next = change(current ?? []);
      saveVocab(next);
      return next;
    });

  const value = {
    english,
    cards,
    saveGoal: (goal: string, minutesPerDay: number) => updateEnglish((s) => ({ ...s, goal, minutesPerDay })),
    applyAssessment: (a: { level: EnglishState["level"]; summary: string; strengths: string[]; weaknesses: string[] }) =>
      updateEnglish((s) => ({ ...s, ...a, assessedAt: Date.now() })),
    applyPlan: (units: { title: string; goal: string; grammar: string; vocabulary: { en: string; de: string; example: string }[] }[]) => {
      const planUnits = units.map((u, i) => ({
        id: crypto.randomUUID(),
        title: u.title,
        goal: u.goal,
        grammar: u.grammar,
        status: (i === 0 ? "active" : "locked") as "active" | "locked",
      }));
      updateEnglish((s) => ({ ...s, units: planUnits, planCreatedAt: Date.now() }));
      // Alte Plan-Vokabeln, die noch nie gelernt wurden, ersetzen; Gelerntes und eigene Wörter bleiben.
      updateCards((current) => [
        ...current.filter((c) => c.unitId === null || c.reps > 0 || c.lapses > 0),
        ...units.flatMap((u, i) => u.vocabulary.map((v) => newCard({ ...v, unitId: planUnits[i].id }, i === 0))),
      ]);
    },
    completeUnit: (unitId: string) => {
      // Nächste noch gesperrte Einheit nach dieser (aus dem aktuellen Stand berechnet).
      const units = english?.units ?? [];
      const index = units.findIndex((u) => u.id === unitId);
      const nextId = units.slice(index + 1).find((u) => u.status === "locked")?.id ?? null;
      updateEnglish((s) => ({
        ...s,
        units: s.units.map((u) => (u.id === unitId ? { ...u, status: "done" } : u.id === nextId ? { ...u, status: "active" } : u)),
      }));
      // Vokabeln der nächsten Einheit freischalten.
      const now = Date.now();
      updateCards((current) => current.map((c) => (nextId && c.unitId === nextId && c.due === null ? { ...c, due: now } : c)));
    },
    reviewCard: (cardId: string, rating: Parameters<typeof review>[1]) =>
      updateCards((current) => current.map((c) => (c.id === cardId ? review(c, rating) : c))),
    addCard: (en: string, de: string, example: string) =>
      updateCards((current) => [...current, newCard({ en, de, example, unitId: null }, true)]),
    deleteCard: (cardId: string) => updateCards((current) => current.filter((c) => c.id !== cardId)),
  };

  return <EnglishContext.Provider value={value}>{children}</EnglishContext.Provider>;
}
