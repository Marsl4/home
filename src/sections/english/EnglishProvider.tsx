// Lädt die Personen (Profile) und für die gewählte Person Profil, Lernplan und Vokabeln.
// Stellt Funktionen zum Ändern bereit (alles wird sofort gespeichert – immer bei der richtigen Person).
import { useEffect, useState, type ReactNode } from "react";

import {
  DEFAULT_ENGLISH_PROFILE,
  deleteEnglishProfileData,
  englishKey,
  loadEnglish,
  loadEnglishProfiles,
  loadVocab,
  saveEnglish,
  saveEnglishProfiles,
  saveVocab,
  vocabKey,
  type EnglishProfile,
  type EnglishState,
  type VocabCard,
} from "../../storage/db";
import { useLiveSync } from "../../storage/liveSync";
import { usePersistentState } from "../../storage/uiState";
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

// Daten EINER Person. profileId steht mit drin, damit beim Speichern klar ist, wem sie gehören
// (auch wenn gerade zu einer anderen Person gewechselt wird).
type ProfileData = { profileId: string; english: EnglishState | null; cards: VocabCard[] };

export function EnglishProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<EnglishProfile[] | null>(null);
  // Wer gerade lernt, merkt sich jedes Gerät selbst (nicht im Sync).
  const [chosenId, setChosenId] = usePersistentState<string>("ui:englishProfile", DEFAULT_ENGLISH_PROFILE);
  const [data, setData] = useState<ProfileData | null>(null);

  // Gibt es die gewählte Person nicht (mehr)? Dann die erste nehmen.
  const profileId = profiles?.some((p) => p.id === chosenId) ? chosenId : (profiles?.[0]?.id ?? DEFAULT_ENGLISH_PROFILE);

  useEffect(() => {
    loadEnglishProfiles().then(setProfiles);
  }, []);

  // Daten der gewählten Person laden. Bis sie da sind, bleiben die bisherigen sichtbar.
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadEnglish(profileId), loadVocab(profileId)]).then(([state, cards]) => {
      if (!cancelled) setData({ profileId, english: state ? { ...EMPTY, ...state } : null, cards });
    });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  // Vom anderen Gerät (Sync) geänderte Daten sofort übernehmen.
  useLiveSync<EnglishProfile[]>("english-profiles", (list) => {
    if (list?.length) setProfiles(list); // leere Liste nie übernehmen – mindestens eine Person bleibt
  });
  useLiveSync<EnglishState>(englishKey(profileId), (state) =>
    setData((current) => (current?.profileId === profileId ? { ...current, english: state } : current)),
  );
  useLiveSync<VocabCard[]>(vocabKey(profileId), (cards) =>
    setData((current) => (current?.profileId === profileId ? { ...current, cards } : current)),
  );

  if (!profiles || !data) return null;

  // ---------- Personen ----------
  const updateProfiles = (change: (current: EnglishProfile[]) => EnglishProfile[]) =>
    setProfiles((current) => {
      const next = change(current ?? []);
      saveEnglishProfiles(next);
      return next;
    });

  const addProfile = () => {
    const id = crypto.randomUUID();
    updateProfiles((current) => {
      // Nächste freie Nummer: "Person 2", "Person 3" …
      let number = current.length + 1;
      while (current.some((p) => p.name === `Person ${number}`)) number++;
      return [...current, { id, name: `Person ${number}`, createdAt: Date.now() }];
    });
    setChosenId(id);
    return id;
  };

  const renameProfile = (id: string, name: string) => {
    const trimmed = name.trim();
    if (trimmed) updateProfiles((current) => current.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
  };

  const deleteProfile = (id: string) => {
    if (profiles.length <= 1) return; // mindestens eine Person bleibt
    updateProfiles((current) => current.filter((p) => p.id !== id));
    deleteEnglishProfileData(id);
    try {
      localStorage.removeItem(id === DEFAULT_ENGLISH_PROFILE ? "ui:englishTestDraft" : `ui:englishTestDraft:${id}`);
    } catch {
      // egal – war nur ein angefangener Test
    }
    if (id === profileId) setChosenId(profiles.find((p) => p.id !== id)!.id);
  };

  // ---------- Daten der gewählten Person ----------
  const updateEnglish = (change: (current: EnglishState) => EnglishState) =>
    setData((current) => {
      if (!current) return current;
      const next = change({ ...EMPTY, ...(current.english ?? {}) });
      saveEnglish(current.profileId, next);
      return { ...current, english: next };
    });
  const updateCards = (change: (current: VocabCard[]) => VocabCard[]) =>
    setData((current) => {
      if (!current) return current;
      const next = change(current.cards);
      saveVocab(current.profileId, next);
      return { ...current, cards: next };
    });

  const { english, cards } = data;

  const value = {
    profiles,
    profileId: data.profileId,
    selectProfile: setChosenId,
    addProfile,
    renameProfile,
    deleteProfile,

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
    replaceFutureUnits: (
      units: { title: string; goal: string; grammar: string; vocabulary: { en: string; de: string; example: string }[] }[],
      settings: { goal: string; minutesPerDay: number },
    ) => {
      const kept = (english?.units ?? []).filter((u) => u.status !== "locked");
      const removedIds = new Set((english?.units ?? []).filter((u) => u.status === "locked").map((u) => u.id));
      // Ist keine Einheit mehr aktiv (alle erledigt), wird die erste neue gleich freigeschaltet.
      const startNow = !kept.some((u) => u.status === "active");
      const newUnits = units.map((u, i) => ({
        id: crypto.randomUUID(),
        title: u.title,
        goal: u.goal,
        grammar: u.grammar,
        status: (startNow && i === 0 ? "active" : "locked") as "active" | "locked",
      }));
      updateEnglish((s) => ({
        ...s,
        ...settings,
        units: [...s.units.filter((u) => !removedIds.has(u.id)), ...newUnits],
      }));
      // Vokabeln der ersetzten Einheiten entfernen – aber nur, wenn sie noch nie geübt wurden.
      updateCards((current) => [
        ...current.filter((c) => !(c.unitId && removedIds.has(c.unitId) && c.reps === 0 && c.lapses === 0)),
        ...units.flatMap((u, i) => u.vocabulary.map((v) => newCard({ ...v, unitId: newUnits[i].id }, startNow && i === 0))),
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
