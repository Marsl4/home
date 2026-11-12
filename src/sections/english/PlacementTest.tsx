// Einstufungstest: Ziel angeben → KI erstellt den Test → Fragen beantworten → kurze Schreibprobe →
// KI wertet aus (Niveau A1–C2, Stärken/Schwächen) → daraus wird der Lernplan erstellt.
// Ein angefangener Test bleibt gespeichert (auch wenn man zwischendurch woanders hinwechselt).
import { useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { describeAiError, isAiServiceError } from "../../ai/provider";
import { DEFAULT_ENGLISH_PROFILE } from "../../storage/db";
import { usePersistentState } from "../../storage/uiState";
import { useEnglish } from "./EnglishContext";
import { assess, createPlacementTest, createPlan, type Assessment, type PlacementTest as Test } from "./englishAi";

const GOALS = [
  "Alltag & Reisen",
  "Studium (Fachtexte lesen, Vorlesungen verstehen)",
  "Beruf & Business",
  "Prüfung (z. B. TOEFL, IELTS, Cambridge)",
];

type Draft = {
  test: Test;
  answers: (number | null)[];
  index: number; // aktuelle Frage
  writing: string;
} | null;

// onStart: den Test fest als offene Seite merken (sonst springt die Ansicht nach der Auswertung zur Übersicht).
export function PlacementTest({ onStart, onPlanReady }: { onStart: () => void; onPlanReady: () => void }) {
  const { english, profileId, saveGoal, applyAssessment, applyPlan } = useEnglish();
  const [goal, setGoal] = useState(english?.goal || GOALS[1]);
  const [minutes, setMinutes] = useState(english?.minutesPerDay ?? 15);
  // Angefangener Test – pro Person (die erste Person nutzt den alten Schlüssel weiter).
  const [draft, setDraft] = usePersistentState<Draft>(
    profileId === DEFAULT_ENGLISH_PROFILE ? "ui:englishTestDraft" : `ui:englishTestDraft:${profileId}`,
    null,
  );
  const [result, setResult] = useState<Assessment | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // Text, was gerade passiert
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = async (label: string, task: (signal: AbortSignal) => Promise<void>) => {
    setError(null);
    setBusy(label);
    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = Date.now();
    try {
      await task(controller.signal);
    } catch (e) {
      if (controller.signal.aborted) return;
      // Fehler von Google bzw. der Verbindung verständlich machen, eigene Meldungen direkt zeigen.
      const message =
        isAiServiceError(e)
          ? describeAiError(e, { withAttachment: false })
          : e instanceof Error
            ? e.message
            : String(e);
      // Wie lange es bis zum Fehler gedauert hat, hilft bei der Fehlersuche (z. B. ~60 s = Zeitlimit).
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      setError(`${message} (${label.replace(/ …$/, "")} – nach ${seconds} s)`);
    } finally {
      setBusy(null);
    }
  };

  const start = () =>
    run("Die KI erstellt deinen Einstufungstest …", async (signal) => {
      onStart();
      saveGoal(goal, minutes);
      const test = await createPlacementTest(goal, signal);
      setDraft({ test, answers: test.questions.map(() => null), index: 0, writing: "" });
    });

  const finish = () =>
    run("Die KI wertet deinen Test aus …", async (signal) => {
      if (!draft) return;
      const assessment = await assess(draft.test, draft.answers, draft.writing, english?.goal || goal, signal);
      applyAssessment(assessment);
      setResult(assessment);
      setDraft(null);
    });

  const buildPlan = () =>
    run("Die KI erstellt deinen Lernplan mit Vokabeln …", async (signal) => {
      const level = result?.level ?? english?.level;
      if (!level) return;
      const units = await createPlan(
        { level, goal: english?.goal || goal, minutesPerDay: english?.minutesPerDay ?? minutes, weaknesses: result?.weaknesses ?? english?.weaknesses ?? [] },
        signal,
      );
      applyPlan(units);
      onPlanReady();
    });

  if (busy) {
    return (
      <div className="english-card center">
        <Loader2 size={28} className="spin" />
        <p>{busy}</p>
        <p className="muted">Das dauert meist 10–40 Sekunden.</p>
        <button className="text-button" onClick={() => abortRef.current?.abort()}>
          Abbrechen
        </button>
      </div>
    );
  }

  // ---------- Ergebnis ----------
  if (result) {
    return (
      <div className="english-card">
        <div className="english-level-big">{result.level}</div>
        <h2>Dein Englisch-Niveau</h2>
        <p>{result.summary}</p>
        <div className="english-columns">
          <div>
            <h3>Stärken</h3>
            <ul>{result.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
          <div>
            <h3>Daran arbeiten wir</h3>
            <ul>{result.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
        </div>
        {error && <p className="settings-status error">{error}</p>}
        <button className="primary-button" onClick={buildPlan}>
          <Sparkles size={16} /> Lernplan erstellen
        </button>
      </div>
    );
  }

  // ---------- Fragen ----------
  if (draft) {
    const { test, answers, index } = draft;
    const total = test.questions.length;
    if (index < total) {
      const q = test.questions[index];
      const choose = (answer: number | null) => {
        const next = [...answers];
        next[index] = answer;
        setDraft({ ...draft, answers: next, index: index + 1 });
      };
      return (
        <div className="english-card">
          <div className="english-progress">
            <span style={{ width: `${(index / (total + 1)) * 100}%` }} />
          </div>
          <p className="muted">
            Frage {index + 1} von {total} · {q.level}
          </p>
          <h2 className="english-question">{q.question}</h2>
          <div className="english-options">
            {q.options.map((option, i) => (
              <button key={i} className="english-option" onClick={() => choose(i)}>
                {option}
              </button>
            ))}
          </div>
          <div className="english-test-nav">
            <button className="text-button" disabled={index === 0} onClick={() => setDraft({ ...draft, index: index - 1 })}>
              ← Zurück
            </button>
            <button className="text-button" onClick={() => choose(null)}>
              Weiß ich nicht →
            </button>
          </div>
        </div>
      );
    }
    // Schreibprobe
    return (
      <div className="english-card">
        <div className="english-progress">
          <span style={{ width: `${(total / (total + 1)) * 100}%` }} />
        </div>
        <p className="muted">Zum Schluss: kurze Schreibprobe</p>
        <h2>{test.writingTask}</h2>
        <textarea
          className="english-writing"
          value={draft.writing}
          placeholder="Write here …"
          rows={6}
          lang="en"
          onChange={(e) => setDraft({ ...draft, writing: e.target.value })}
        />
        {error && <p className="settings-status error">{error}</p>}
        <div className="english-test-nav">
          <button className="text-button" onClick={() => setDraft({ ...draft, index: total - 1 })}>
            ← Zurück
          </button>
          <button className="primary-button" onClick={finish}>
            Test auswerten
          </button>
        </div>
      </div>
    );
  }

  // ---------- Start: Ziel angeben ----------
  return (
    <div className="english-card">
      <h2>Einstufungstest</h2>
      <p>
        Ca. 10 Minuten: 24 Fragen von leicht bis schwer und eine kurze Schreibprobe. Danach weißt du dein Niveau
        (A1 bis C2) und bekommst einen passenden Lernplan mit Vokabeln.
      </p>
      <label className="english-field">
        <span>Wofür brauchst du Englisch vor allem?</span>
        <div className="english-choice">
          {GOALS.map((g) => (
            <button key={g} className={g === goal ? "selected" : ""} onClick={() => setGoal(g)}>
              {g}
            </button>
          ))}
        </div>
      </label>
      <label className="english-field">
        <span>Wie viel Zeit hast du pro Tag?</span>
        <div className="english-choice">
          {[10, 15, 30, 45].map((m) => (
            <button key={m} className={m === minutes ? "selected" : ""} onClick={() => setMinutes(m)}>
              {m} Min.
            </button>
          ))}
        </div>
      </label>
      {english?.units.length ? (
        <p className="muted">Hinweis: Nach dem Test kannst du einen neuen Plan erstellen. Bereits gelernte Vokabeln bleiben erhalten.</p>
      ) : null}
      {error && <p className="settings-status error">{error}</p>}
      <button className="primary-button" onClick={start}>
        <Sparkles size={16} /> Test starten
      </button>
    </div>
  );
}
