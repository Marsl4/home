// Lernplan: Einheiten nacheinander (gesperrt → aktiv → fertig) mit ihren Vokabeln.
// Oben lässt sich der Plan anpassen (z. B. mehr Zeit pro Tag): Die KI erstellt dann die zukünftigen Einheiten neu.
import { useRef, useState } from "react";
import { CheckCircle2, Circle, Loader2, Lock, SlidersHorizontal } from "lucide-react";

import { describeAiError, isAiServiceError } from "../../ai/provider";
import type { EnglishUnit } from "../../storage/db";
import { useEnglish } from "./EnglishContext";
import { createPlan, GOALS, MINUTE_OPTIONS, wordsPerUnit } from "./englishAi";
import { isDue } from "./srs";
import { SpeakButton } from "./VocabTrainer";

export function PlanView({ onLearn, onRetest }: { onLearn: () => void; onRetest: () => void }) {
  const { english, cards, completeUnit } = useEnglish();
  const units = english?.units ?? [];
  const [openId, setOpenId] = useState<string | null>(units.find((u) => u.status === "active")?.id ?? null);
  const [adjusting, setAdjusting] = useState(false);

  if (!units.length) {
    return (
      <div className="english-card center">
        <h2>Noch kein Lernplan</h2>
        <p className="muted">Mach zuerst den Einstufungstest – danach erstellt die KI deinen Plan.</p>
        <button className="primary-button" onClick={onRetest}>
          Zum Einstufungstest
        </button>
      </div>
    );
  }

  const icon = (unit: EnglishUnit) =>
    unit.status === "done" ? <CheckCircle2 size={18} className="unit-done" /> : unit.status === "active" ? <Circle size={18} className="unit-active" /> : <Lock size={16} className="muted" />;

  return (
    <div className="english-plan">
      {adjusting ? (
        <AdjustPlan onDone={() => setAdjusting(false)} />
      ) : (
        <div className="english-plan-bar">
          <span className="muted">
            {english?.minutesPerDay} Min. pro Tag · {wordsPerUnit(english?.minutesPerDay ?? 15)} Vokabeln pro neuer Einheit
          </span>
          <button className="secondary-button" onClick={() => setAdjusting(true)}>
            <SlidersHorizontal size={14} /> Plan anpassen
          </button>
        </div>
      )}
      {units.map((unit) => {
        const unitCards = cards.filter((c) => c.unitId === unit.id);
        const learned = unitCards.filter((c) => c.reps >= 2).length;
        const dueCount = unitCards.filter((c) => isDue(c)).length;
        const open = openId === unit.id;
        return (
          <div key={unit.id} className={`english-unit ${unit.status}`}>
            <button className="english-unit-head" onClick={() => setOpenId(open ? null : unit.id)}>
              {icon(unit)}
              <span className="english-unit-title">{unit.title}</span>
              <span className="muted">
                {unit.status === "locked" ? "gesperrt" : `${learned}/${unitCards.length} sicher`}
              </span>
            </button>
            {open && (
              <div className="english-unit-body">
                <p>{unit.goal}</p>
                <p className="muted">Grammatik: {unit.grammar}</p>
                <div className="english-words">
                  {unitCards.map((c) => (
                    <div key={c.id} className="english-word">
                      <strong>{c.en}</strong>
                      <SpeakButton text={c.en} />
                      <span>{c.de}</span>
                    </div>
                  ))}
                </div>
                {unit.status === "active" && (
                  <div className="english-unit-actions">
                    <button className="primary-button" onClick={onLearn} disabled={dueCount === 0}>
                      {dueCount ? `${dueCount} Vokabeln lernen` : "Gerade nichts fällig"}
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => {
                        if (window.confirm("Einheit abschließen und die nächste freischalten?")) {
                          completeUnit(unit.id);
                          setOpenId(units[units.indexOf(unit) + 1]?.id ?? null);
                        }
                      }}
                    >
                      Einheit abschließen
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      <button className="text-button" onClick={onRetest}>
        Test wiederholen / neuen Plan erstellen
      </button>
    </div>
  );
}

// Zeit pro Tag / Ziel ändern → die KI erstellt die noch gesperrten Einheiten passend neu.
// Erledigte Einheiten, die aktuelle Einheit und alles schon Gelernte bleiben.
function AdjustPlan({ onDone }: { onDone: () => void }) {
  const { english, cards, replaceFutureUnits } = useEnglish();
  const [minutes, setMinutes] = useState(english?.minutesPerDay ?? 15);
  const [goal, setGoal] = useState(english?.goal || GOALS[1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const units = english?.units ?? [];
  const kept = units.filter((u) => u.status !== "locked");
  const lockedCount = units.length - kept.length;
  // Nichts mehr gesperrt (letzte Einheit läuft oder alles fertig)? Dann den Plan um 4 Einheiten verlängern.
  const count = lockedCount > 0 ? lockedCount : 4;

  const run = async () => {
    if (!english?.level) return;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const newUnits = await createPlan(
        {
          level: english.level,
          goal,
          minutesPerDay: minutes,
          weaknesses: english.weaknesses,
          count,
          previousUnits: kept.map((u) => u.title),
          knownWords: cards.map((c) => c.en),
        },
        controller.signal,
      );
      replaceFutureUnits(newUnits, { goal, minutesPerDay: minutes });
      onDone();
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(isAiServiceError(e) ? describeAiError(e, { withAttachment: false }) : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <div className="english-card center">
        <Loader2 size={28} className="spin" />
        <p>Die KI passt deinen Lernplan an …</p>
        <button className="text-button" onClick={() => abortRef.current?.abort()}>
          Abbrechen
        </button>
      </div>
    );
  }

  return (
    <div className="english-card">
      <h2>Plan anpassen</h2>
      <label className="english-field">
        <span>Wie viel Zeit hast du jetzt pro Tag?</span>
        <div className="english-choice">
          {MINUTE_OPTIONS.map((m) => (
            <button key={m} className={m === minutes ? "selected" : ""} onClick={() => setMinutes(m)}>
              {m} Min.
            </button>
          ))}
        </div>
      </label>
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
      <p className="muted">
        {lockedCount > 0
          ? `Die ${lockedCount} noch gesperrten Einheiten werden neu erstellt`
          : "Dein Plan wird um 4 neue Einheiten verlängert"}{" "}
        – mit {wordsPerUnit(minutes)} Vokabeln pro Einheit. Erledigte Einheiten, die aktuelle Einheit und alles
        schon Gelernte bleiben erhalten.
      </p>
      {error && <p className="settings-status error">{error}</p>}
      <div className="english-unit-actions">
        <button className="primary-button" onClick={run}>
          {lockedCount > 0 ? "Plan neu erstellen" : "Plan verlängern"}
        </button>
        <button className="text-button" onClick={onDone}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
