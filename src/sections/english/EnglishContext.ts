// Gemeinsamer Zustand des Englisch-Bereichs: Profil + Lernplan und die Vokabelkarten.
import { createContext, useContext } from "react";

import type { EnglishState, VocabCard } from "../../storage/db";
import type { Assessment, PlanUnit } from "./englishAi";
import type { Rating } from "./srs";

export type EnglishContextValue = {
  english: EnglishState | null; // null = noch nie angefangen
  cards: VocabCard[];
  saveGoal: (goal: string, minutesPerDay: number) => void;
  applyAssessment: (assessment: Assessment) => void;
  applyPlan: (units: PlanUnit[]) => void; // ersetzt den bisherigen Plan (eigene Vokabeln bleiben)
  completeUnit: (unitId: string) => void; // Einheit fertig -> nächste wird freigeschaltet
  reviewCard: (cardId: string, rating: Rating) => void;
  addCard: (en: string, de: string, example: string) => void;
  deleteCard: (cardId: string) => void;
};

export const EnglishContext = createContext<EnglishContextValue | null>(null);

export function useEnglish(): EnglishContextValue {
  const value = useContext(EnglishContext);
  if (!value) throw new Error("useEnglish muss innerhalb von <EnglishProvider> benutzt werden");
  return value;
}

// Unterbereiche in der Leiste
export const ENGLISH_PAGES = {
  overview: "overview",
  test: "test",
  plan: "plan",
  learn: "learn",
  words: "words",
} as const;
