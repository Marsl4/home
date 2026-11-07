// Lernplan: Einheiten nacheinander (gesperrt → aktiv → fertig) mit ihren Vokabeln.
import { useState } from "react";
import { CheckCircle2, Circle, Lock } from "lucide-react";

import type { EnglishUnit } from "../../storage/db";
import { useEnglish } from "./EnglishContext";
import { isDue } from "./srs";
import { SpeakButton } from "./VocabTrainer";

export function PlanView({ onLearn, onRetest }: { onLearn: () => void; onRetest: () => void }) {
  const { english, cards, completeUnit } = useEnglish();
  const units = english?.units ?? [];
  const [openId, setOpenId] = useState<string | null>(units.find((u) => u.status === "active")?.id ?? null);

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
