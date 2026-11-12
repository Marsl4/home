// Hauptansicht Englisch: Übersicht, Einstufungstest, Lernplan, Vokabeln lernen, alle Vokabeln, Personen.
import { Languages } from "lucide-react";

import type { SectionProps } from "../types";
import { ENGLISH_PAGES, useEnglish } from "./EnglishContext";
import { PeopleView } from "./PeopleView";
import { PlacementTest } from "./PlacementTest";
import { PlanView } from "./PlanView";
import { isDue } from "./srs";
import { VocabList } from "./VocabList";
import { VocabTrainer } from "./VocabTrainer";

const TITLES: Record<string, string> = {
  overview: "Englisch",
  test: "Einstufungstest",
  plan: "Lernplan",
  learn: "Vokabeln lernen",
  words: "Alle Vokabeln",
  people: "Personen",
};

export function EnglishView({ selectedId, onSelect }: SectionProps) {
  const { english, profiles, profileId } = useEnglish();
  // Noch nie getestet: direkt beim Test starten.
  const page = selectedId ?? (english?.level ? ENGLISH_PAGES.overview : ENGLISH_PAGES.test);
  const person = profiles.find((p) => p.id === profileId);

  return (
    <div className="english">
      {/* key: Beim Wechsel der Person alles neu aufbauen (z. B. ihren angefangenen Test laden). */}
      <div className="english-inner" key={profileId}>
        <h1 className="browser-title">{TITLES[page] ?? "Englisch"}</h1>
        {page !== "people" && profiles.length > 1 && person && <p className="muted english-for">für {person.name}</p>}
        {page === "people" && <PeopleView onStartTest={() => onSelect(ENGLISH_PAGES.test)} />}
        {page === "test" && (
          <PlacementTest onStart={() => onSelect(ENGLISH_PAGES.test)} onPlanReady={() => onSelect(ENGLISH_PAGES.plan)} />
        )}
        {page === "plan" && <PlanView onLearn={() => onSelect(ENGLISH_PAGES.learn)} onRetest={() => onSelect(ENGLISH_PAGES.test)} />}
        {page === "learn" && <VocabTrainer />}
        {page === "words" && <VocabList />}
        {page === "overview" && <Overview onSelect={onSelect} />}
      </div>
    </div>
  );
}

function Overview({ onSelect }: { onSelect: (id: string) => void }) {
  const { english, cards } = useEnglish();
  if (!english?.level) {
    return (
      <div className="english-card center">
        <Languages size={32} />
        <h2>Willkommen beim Englisch-Training</h2>
        <p className="muted">Starte mit dem Einstufungstest – danach bekommst du einen Plan, der zu dir passt.</p>
        <button className="primary-button" onClick={() => onSelect(ENGLISH_PAGES.test)}>
          Einstufungstest starten
        </button>
      </div>
    );
  }
  const due = cards.filter((c) => isDue(c)).length;
  const active = english.units.find((u) => u.status === "active");
  const done = english.units.filter((u) => u.status === "done").length;
  return (
    <div className="english-overview">
      <div className="english-card">
        <div className="english-level-big">{english.level}</div>
        <p>{english.summary}</p>
        <p className="muted">Ziel: {english.goal} · {english.minutesPerDay} Min. pro Tag</p>
      </div>
      <div className="english-stats">
        <button className="english-stat" onClick={() => onSelect(ENGLISH_PAGES.learn)}>
          <strong>{due}</strong>
          <span>Vokabeln heute fällig</span>
        </button>
        <button className="english-stat" onClick={() => onSelect(ENGLISH_PAGES.plan)}>
          <strong>
            {done}/{english.units.length}
          </strong>
          <span>Einheiten geschafft</span>
        </button>
        <button className="english-stat" onClick={() => onSelect(ENGLISH_PAGES.words)}>
          <strong>{cards.filter((c) => c.reps >= 2).length}</strong>
          <span>Vokabeln sicher</span>
        </button>
      </div>
      {active && (
        <div className="english-card">
          <p className="muted">Aktuelle Einheit</p>
          <h2>{active.title}</h2>
          <p>{active.goal}</p>
          <button className="primary-button" onClick={() => onSelect(due ? ENGLISH_PAGES.learn : ENGLISH_PAGES.plan)}>
            {due ? "Jetzt lernen" : "Zum Lernplan"}
          </button>
        </div>
      )}
    </div>
  );
}
