// Abfragemodus: Die KI stellt Fragen zu einer Notiz, einem PDF oder eigenem Text.
// Offene Fragen: in eigenen Worten antworten, die KI bewertet. Multiple Choice: antippen.
// Am Ende: Auswertung, nicht Gewusstes lässt sich als Karteikarten speichern.
// Eine angefangene Abfrage bleibt erhalten (auch wenn man zwischendurch woanders hingeht).
import { useRef, useState } from "react";
import { CircleCheck, CircleX, Layers, Loader2, MessageCircleQuestionMark, RotateCcw, Sparkles } from "lucide-react";

import { AiMarkdown } from "../../ai/AiMarkdown";
import { describeAiError, isAiServiceError } from "../../ai/provider";
import { usePersistentState } from "../../storage/uiState";
import { useNotes } from "../notes/NotesContext";
import { folderPath } from "../uni/folders";
import { useLearn } from "./LearnContext";
import { createQuiz, gradeAnswer, type Grade, type Material, type QuizKind, type QuizQuestion } from "./learnAi";
import { MaterialPicker } from "./MaterialPicker";

type Answer = { given: string | number | null; grade: Grade | null };

type Session = {
  title: string; // woraus gefragt wird
  kind: QuizKind;
  questions: QuizQuestion[];
  answers: Answer[];
  index: number; // aktuelle Frage (= questions.length → Auswertung)
};

const errorText = (e: unknown) =>
  isAiServiceError(e) ? describeAiError(e, { withAttachment: false }) : e instanceof Error ? e.message : String(e);

export function QuizView() {
  const [session, setSession] = usePersistentState<Session | null>("ui:quiz", null);
  if (!session) return <QuizSetup onStart={setSession} />;
  if (session.index >= session.questions.length) {
    return (
      <QuizSummary
        session={session}
        onRestart={() => setSession({ ...session, index: 0, answers: session.questions.map(() => ({ given: null, grade: null })) })}
        onNew={() => setSession(null)}
      />
    );
  }
  // key: pro Frage neu aufbauen (leeres Antwortfeld)
  return <QuizQuestionView key={session.index} session={session} onChange={setSession} onCancel={() => setSession(null)} />;
}

// ---------- Einstellen ----------
function QuizSetup({ onStart }: { onStart: (session: Session) => void }) {
  const { subjects } = useNotes();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [kind, setKind] = useState<QuizKind>("open");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const folderOptions = subjects
    .map((s) => ({ id: s.id, label: folderPath(subjects, s.id).map((f) => f.name || "Ohne Namen").join(" › ") }))
    .sort((a, b) => a.label.localeCompare(b.label, "de"));

  const start = async () => {
    if (!material) return;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const questions = await createQuiz(material, count, kind, controller.signal);
      onStart({
        title: material.kind === "text" ? "Eigener Text" : material.source.title,
        kind,
        questions,
        answers: questions.map(() => ({ given: null, grade: null })),
        index: 0,
      });
    } catch (e) {
      if (!controller.signal.aborted) setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <div className="english-card center">
        <Loader2 size={28} className="spin" />
        <p>Die KI überlegt sich Fragen …</p>
        <button className="text-button" onClick={() => abortRef.current?.abort()}>
          Abbrechen
        </button>
      </div>
    );
  }

  return (
    <div className="english-card">
      <h2>
        <MessageCircleQuestionMark size={20} /> Abfragen lassen
      </h2>
      <p className="muted">Die KI stellt dir Fragen zu deinem Material – wie in einer mündlichen Prüfung.</p>
      {folderOptions.length > 0 && (
        <label className="deck-folder muted">
          Fach:
          <select value={folderId ?? ""} onChange={(e) => setFolderId(e.target.value || null)}>
            <option value="">– alle –</option>
            {folderOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <MaterialPicker key={folderId ?? "alle"} folderId={folderId} onChange={setMaterial} />
      <label className="english-field">
        <span>Art der Fragen</span>
        <div className="english-choice">
          <button className={kind === "open" ? "selected" : ""} onClick={() => setKind("open")}>
            Offene Fragen (in eigenen Worten)
          </button>
          <button className={kind === "choice" ? "selected" : ""} onClick={() => setKind("choice")}>
            Multiple Choice
          </button>
        </div>
      </label>
      <label className="english-field">
        <span>Wie viele Fragen?</span>
        <div className="english-choice">
          {[5, 10, 15].map((n) => (
            <button key={n} className={n === count ? "selected" : ""} onClick={() => setCount(n)}>
              {n}
            </button>
          ))}
        </div>
      </label>
      {error && <p className="settings-status error">{error}</p>}
      <button className="primary-button" onClick={start} disabled={!material}>
        <Sparkles size={15} /> Abfrage starten
      </button>
    </div>
  );
}

// ---------- Eine Frage ----------
function QuizQuestionView({ session, onChange, onCancel }: { session: Session; onChange: (s: Session) => void; onCancel: () => void }) {
  const q = session.questions[session.index];
  const answer = session.answers[session.index];
  const [text, setText] = useState(typeof answer.given === "string" ? answer.given : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const total = session.questions.length;

  const setAnswer = (next: Answer) =>
    onChange({ ...session, answers: session.answers.map((a, i) => (i === session.index ? next : a)) });
  const next = () => onChange({ ...session, index: session.index + 1 });

  const check = async (given: string) => {
    if (!given.trim()) {
      setAnswer({ given: "", grade: { result: "wrong", feedback: "Kein Problem – schau dir die Musterantwort an." } });
      return;
    }
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setAnswer({ given, grade: await gradeAnswer(q, given, controller.signal) });
    } catch (e) {
      if (!controller.signal.aborted) setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const choose = (index: number) => {
    const right = index === q.correctIndex;
    setAnswer({ given: index, grade: { result: right ? "right" : "wrong", feedback: q.explanation ?? "" } });
  };

  const graded = answer.grade;
  return (
    <div className="english-card quiz-card">
      <div className="english-progress">
        <span style={{ width: `${(session.index / total) * 100}%` }} />
      </div>
      <p className="muted">
        Frage {session.index + 1} von {total} · {session.title}
      </p>
      <h2 className="quiz-question">{q.question}</h2>

      {session.kind === "choice" ? (
        <div className="english-options">
          {(q.options ?? []).map((option, i) => {
            const state = !graded ? "" : i === q.correctIndex ? "correct" : i === answer.given ? "wrong" : "";
            return (
              <button key={i} className={`english-option ${state}`} onClick={() => !graded && choose(i)} disabled={!!graded}>
                {option}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <textarea
            className="material-text"
            placeholder="Deine Antwort in eigenen Worten …"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            disabled={!!graded || busy}
            autoFocus
          />
          {!graded && (
            <div className="deck-actions">
              <button className="primary-button" onClick={() => check(text)} disabled={busy || !text.trim()}>
                {busy ? <Loader2 size={15} className="spin" /> : null} Antwort prüfen
              </button>
              <button className="text-button" onClick={() => check("")} disabled={busy}>
                Weiß ich nicht
              </button>
            </div>
          )}
        </>
      )}

      {error && <p className="settings-status error">{error}</p>}

      {graded && (
        <div className={`quiz-result ${graded.result}`}>
          <strong>
            {graded.result === "right" ? <CircleCheck size={16} /> : <CircleX size={16} />}
            {graded.result === "right" ? "Richtig!" : graded.result === "partly" ? "Teilweise richtig" : "Leider nicht richtig"}
          </strong>
          {graded.feedback && <p>{graded.feedback}</p>}
          <div className="quiz-model">
            <span className="muted">Musterantwort</span>
            <AiMarkdown text={q.answer} />
          </div>
        </div>
      )}

      <div className="deck-actions quiz-nav">
        {graded && (
          <button className="primary-button" onClick={next}>
            {session.index + 1 < total ? "Nächste Frage" : "Zur Auswertung"}
          </button>
        )}
        <button className="text-button" onClick={() => window.confirm("Abfrage beenden?") && onCancel()}>
          Abfrage beenden
        </button>
      </div>
    </div>
  );
}

// ---------- Auswertung ----------
function QuizSummary({ session, onRestart, onNew }: { session: Session; onRestart: () => void; onNew: () => void }) {
  const { decks, addDeck, addCards } = useLearn();
  const points = session.answers.reduce((sum, a) => sum + (a.grade?.result === "right" ? 1 : a.grade?.result === "partly" ? 0.5 : 0), 0);
  const total = session.questions.length;
  const missed = session.questions.filter((_, i) => session.answers[i].grade?.result !== "right");
  const [deckId, setDeckId] = useState<string>(decks[0]?.id ?? "new");
  const [saved, setSaved] = useState(false);

  const saveCards = () => {
    const target = deckId === "new" ? addDeck(`Abfrage: ${session.title}`) : deckId;
    addCards(target, missed.map((q) => ({ front: q.question, back: q.answer })));
    setSaved(true);
  };

  return (
    <div className="english-card">
      <div className="english-level-big">
        {points.toLocaleString("de-DE")} / {total}
      </div>
      <h2>{points / total >= 0.8 ? "Sehr gut!" : points / total >= 0.5 ? "Gut – da geht noch was." : "Weiter üben!"}</h2>
      <p className="muted">{session.title}</p>
      <ul className="project-tasks quiz-summary">
        {session.questions.map((q, i) => {
          const result = session.answers[i].grade?.result ?? "wrong";
          return (
            <li key={i} className={`quiz-summary-item ${result}`}>
              {result === "right" ? <CircleCheck size={16} /> : <CircleX size={16} />}
              <span>{q.question}</span>
            </li>
          );
        })}
      </ul>

      {missed.length > 0 && (
        <div className="quiz-save">
          {saved ? (
            <p className="settings-status ok">
              <Layers size={14} /> {missed.length} Karten gespeichert – sie kommen jetzt unter „Heute lernen“.
            </p>
          ) : (
            <>
              <span>{missed.length} nicht (ganz) gewusste Fragen als Karteikarten speichern:</span>
              <select className="deck-folder-select" value={deckId} onChange={(e) => setDeckId(e.target.value)}>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name || "Ohne Namen"}
                  </option>
                ))}
                <option value="new">Neuer Stapel „Abfrage: {session.title}“</option>
              </select>
              <button className="secondary-button" onClick={saveCards}>
                <Layers size={14} /> Speichern
              </button>
            </>
          )}
        </div>
      )}

      <div className="deck-actions">
        <button className="primary-button" onClick={onNew}>
          <Sparkles size={15} /> Neue Abfrage
        </button>
        <button className="secondary-button" onClick={onRestart}>
          <RotateCcw size={14} /> Dieselben Fragen nochmal
        </button>
      </div>
    </div>
  );
}
