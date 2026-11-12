// Gemeinsamer Zustand des Englisch-Bereichs: Personen (Profile) und für die gewählte Person
// Profil + Lernplan und die Vokabelkarten.
import { createContext, useContext } from "react";

import type { EnglishProfile, EnglishState, VocabCard } from "../../storage/db";
import type { Assessment, PlanUnit } from "./englishAi";
import type { Rating } from "./srs";

export type EnglishContextValue = {
  // Personen
  profiles: EnglishProfile[];
  profileId: string; // wer gerade lernt
  selectProfile: (profileId: string) => void;
  addProfile: () => string; // legt "Person N" an, wählt sie aus und gibt die ID zurück
  renameProfile: (profileId: string, name: string) => void;
  deleteProfile: (profileId: string) => void; // löscht auch alle Englisch-Daten der Person

  // Daten der gewählten Person
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
  people: "people",
} as const;
