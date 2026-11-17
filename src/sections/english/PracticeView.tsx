// Englisch → Üben: Grammatik (zur Einheit), Schreiben (mit Korrektur), Sprechen (Gespräch mit der KI).
// Angefangene Übungen bleiben pro Person erhalten (auch wenn man zwischendurch woanders hingeht).
import { useRef, useState, type ReactNode } from "react";
import { CircleCheck, CircleX, Dumbbell, Loader2, MessagesSquare, Mic, PenLine, RotateCcw, Send, Square, Volume2 } from "lucide-react";

import { describeAiError, isAiServiceError } from "../../ai/provider";
import { DEFAULT_ENGLISH_PROFILE } from "../../storage/db";
import { usePersistentState } from "../../storage/uiState";
import { useEnglish } from "./EnglishContext";
import {
  conversationTurn,
  correctWriting,
  createGrammarExercises,
  createWritingTask,
  gradeEnglishAnswer,
  type EnglishGrade,
  type GrammarExercise,
  type Turn,
  type WritingFeedback,
} from "./practiceAi";
import { speak } from "./srs";
import { useSpeechInput } from "./useSpeechInput";

type Mode = "menu" | "grammar" | "writing" | "speaking";

type GrammarSession = { unitId: string; exercises: GrammarExercise[]; answers: ({ given: string | number; grade: EnglishGrade } | null)[]; index: number };
type WritingSession = { task: string; text: string; feedback: WritingFeedback | null };
type SpeakingSession = { topic: string; turns: Turn[] };

type Practice = { mode: Mode; grammar: GrammarSession | null; writing: WritingSession | null; speaking: SpeakingSession | null };

const EMPTY: Practice = { mode: "menu", grammar: null, writing: null, speaking: null };

const errorText = (e: unknown) =>
  isAiServiceError(e) ? describeAiError(e, { withAttachment: false }) : e instanceof Error ? e.message : String(e);

// Kleiner Helfer: KI-Aufruf mit Lade-Zustand, Fehlermeldung und Abbrechen
function useAiTask() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const run = async <T,>(task: (signal: AbortSignal) => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      return await task(controller.signal);
    } catch (e) {
      if (!controller.signal.aborted) setError(errorText(e));
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, abort: () => abortRef.current?.abort() };
}

export function PracticeView() {
  const { english, profileId } = useEnglish();
  const key = profileId === DEFAULT_ENGLISH_PROFILE ? "ui:englishPractice" : `ui:englishPractice:${profileId}`;
  const [practice, setPractice] = usePersistentState<Practice>(key, EMPTY);
  const change = (changes: Partial<Practice>) => setPractice({ ...practice, ...changes });
  // Beim Öffnen: angefangene Übung fortsetzen – eine schon fertige Grammatik-Runde nicht, dann das Menü.
  const [mode, setModeState] = useState<Mode>(() => {
    const g = practice.grammar;
    return practice.mode === "grammar" && g && g.index >= g.exercises.length ? "menu" : practice.mode;
  });
  const setMode = (next: Mode) => {
    setModeState(next);
    change({ mode: next });
  };

  if (!english?.level) {
    return <p className="muted">Mach zuerst den Einstufungstest – die Übungen passen sich deinem Niveau an.</p>;
  }

  const back = () => setMode("menu");
  if (mode === "grammar") return <GrammarPractice session={practice.grammar} onChange={(grammar) => change({ grammar })} onBack={back} />;
  if (mode === "writing") return <WritingPractice session={practice.writing} onChange={(writing) => change({ writing })} onBack={back} />;
  if (mode === "speaking") return <SpeakingPractice session={practice.speaking} onChange={(speaking) => change({ speaking })} onBack={back} />;

  const active = english.units.find((u) => u.status === "active");
  return (
    <div className="practice-menu">
      <PracticeCard
        icon={<Dumbbell size={22} />}
        title="Grammatik"
        onClick={() => {
          // fertige Runde: neue starten
          const g = practice.grammar;
          if (g && g.index >= g.exercises.length) setPractice({ ...practice, mode: "grammar", grammar: null });
          else change({ mode: "grammar" });
          setModeState("grammar");
        }}
      >
        {active ? `Übungen zu „${active.grammar}“ (${active.title})` : "Übungen zum Grammatik-Schwerpunkt deiner Einheit"}
        {practice.grammar && practice.grammar.index < practice.grammar.exercises.length && " · angefangen"}
      </PracticeCard>
      <PracticeCard icon={<PenLine size={22} />} title="Schreiben" onClick={() => setMode("writing")}>
        Kurzen Text auf Englisch schreiben – die KI korrigiert und erklärt jeden Fehler.
        {practice.writing && " · angefangen"}
      </PracticeCard>
      <PracticeCard icon={<MessagesSquare size={22} />} title="Sprechen" onClick={() => setMode("speaking")}>
        Gespräch auf Englisch (per Mikrofon oder Tastatur) – mit kurzen Korrekturen.
        {practice.speaking && " · angefangen"}
      </PracticeCard>
    </div>
  );
}

function PracticeCard({ icon, title, children, onClick }: { icon: ReactNode; title: string; children: ReactNode; onClick: () => void }) {
  return (
    <button className="project-card practice-card" onClick={onClick}>
      <div className="practice-icon">{icon}</div>
      <h3>{title}</h3>
      <p className="muted">{children}</p>
    </button>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button className="breadcrumb-link project-back" onClick={onBack}>
      ‹ Üben
    </button>
  );
}

function Busy({ text, onAbort }: { text: string; onAbort: () => void }) {
  return (
    <div className="english-card center">
      <Loader2 size={26} className="spin" />
      <p>{text}</p>
      <button className="text-button" onClick={onAbort}>
        Abbrechen
      </button>
    </div>
  );
}

// ---------- Grammatik ----------
function GrammarPractice({ session, onChange, onBack }: { session: GrammarSession | null; onChange: (s: GrammarSession | null) => void; onBack: () => void }) {
  const { english, saveGrammarScore } = useEnglish();
  const units = (english?.units ?? []).filter((u) => u.status !== "locked");
  const [unitId, setUnitId] = useState(session?.unitId ?? units.find((u) => u.status === "active")?.id ?? units[0]?.id ?? "");
  const ai = useAiTask();

  const start = async () => {
    const unit = units.find((u) => u.id === unitId);
    if (!unit || !english?.level) return;
    const exercises = await ai.run((signal) => createGrammarExercises(english.level!, unit, english.goal, signal));
    if (exercises) onChange({ unitId, exercises, answers: exercises.map(() => null), index: 0 });
  };

  if (ai.busy && !session) return <Busy text="Die KI erstellt Übungen …" onAbort={ai.abort} />;

  if (!session) {
    if (!units.length) return <p className="muted">Erstelle zuerst einen Lernplan.</p>;
    return (
      <>
        <BackLink onBack={onBack} />
        <div className="english-card">
          <h2>
            <Dumbbell size={20} /> Grammatik üben
          </h2>
          <label className="deck-folder muted">
            Einheit:
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.title} – {u.grammar}
                  {u.grammarScore !== undefined ? ` (bisher ${Math.round(u.grammarScore * 100)} %)` : ""}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">8 gemischte Übungen: auswählen, Lücken füllen und kurze Sätze übersetzen.</p>
          {ai.error && <p className="settings-status error">{ai.error}</p>}
          <button className="primary-button" onClick={start}>
            Übungen starten
          </button>
        </div>
      </>
    );
  }

  const total = session.exercises.length;
  if (session.index >= total) {
    const right = session.answers.filter((a) => a?.grade.correct).length;
    return (
      <>
        <BackLink onBack={onBack} />
        <div className="english-card center">
          <div className="english-level-big">
            {right} / {total}
          </div>
          <h2>{right / total >= 0.8 ? "Sehr gut!" : right / total >= 0.5 ? "Gut – weiter so!" : "Das üben wir nochmal."}</h2>
          <div className="deck-actions">
            <button className="primary-button" onClick={() => onChange(null)}>
              Neue Übungen
            </button>
            <button className="secondary-button" onClick={() => onChange({ ...session, answers: session.answers.map(() => null), index: 0 })}>
              <RotateCcw size={14} /> Dieselben nochmal
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <GrammarExerciseView
      key={session.index}
      session={session}
      onAnswer={(answer) => onChange({ ...session, answers: session.answers.map((a, i) => (i === session.index ? answer : a)) })}
      onNext={() => {
        const next = { ...session, index: session.index + 1 };
        if (next.index >= total) {
          const right = session.answers.filter((a) => a?.grade.correct).length;
          saveGrammarScore(session.unitId, right / total);
        }
        onChange(next);
      }}
      onBack={onBack}
    />
  );
}

function GrammarExerciseView(props: {
  session: GrammarSession;
  onAnswer: (answer: { given: string | number; grade: EnglishGrade }) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { session, onAnswer, onNext, onBack } = props;
  const exercise = session.exercises[session.index];
  const answer = session.answers[session.index];
  const [text, setText] = useState("");
  const ai = useAiTask();
  const total = session.exercises.length;

  const check = async () => {
    const grade = await ai.run((signal) => gradeEnglishAnswer(exercise, text, signal));
    if (grade) onAnswer({ given: text, grade });
  };

  return (
    <>
      <BackLink onBack={onBack} />
      <div className="english-card quiz-card">
        <div className="english-progress">
          <span style={{ width: `${(session.index / total) * 100}%` }} />
        </div>
        <p className="muted">
          Übung {session.index + 1} von {total} · {exercise.task}
        </p>
        <h2 className="quiz-question">{exercise.sentence}</h2>
        {exercise.kind === "choice" ? (
          <div className="english-options">
            {(exercise.options ?? []).map((option, i) => {
              const state = !answer ? "" : i === exercise.correctIndex ? "correct" : i === answer.given ? "wrong" : "";
              return (
                <button
                  key={i}
                  className={`english-option ${state}`}
                  disabled={!!answer}
                  onClick={() => onAnswer({ given: i, grade: { correct: i === exercise.correctIndex, feedback: exercise.explanation } })}
                >
                  {option}
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <input
              className="practice-input"
              value={answer ? String(answer.given) : text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && text.trim() && !answer && check()}
              placeholder="Deine Lösung auf Englisch …"
              disabled={!!answer || ai.busy}
              autoFocus
              autoCapitalize="off"
              spellCheck={false}
            />
            {!answer && (
              <div className="deck-actions">
                <button className="primary-button" onClick={check} disabled={ai.busy || !text.trim()}>
                  {ai.busy && <Loader2 size={15} className="spin" />} Prüfen
                </button>
                <button
                  className="text-button"
                  onClick={() => onAnswer({ given: "", grade: { correct: false, feedback: exercise.explanation } })}
                  disabled={ai.busy}
                >
                  Lösung zeigen
                </button>
              </div>
            )}
          </>
        )}
        {ai.error && <p className="settings-status error">{ai.error}</p>}
        {answer && (
          <div className={`quiz-result ${answer.grade.correct ? "right" : "wrong"}`}>
            <strong>
              {answer.grade.correct ? <CircleCheck size={16} /> : <CircleX size={16} />}
              {answer.grade.correct ? "Richtig!" : "Nicht ganz"}
            </strong>
            {answer.grade.feedback && <p>{answer.grade.feedback}</p>}
            <div className="quiz-model">
              <span className="muted">Lösung</span>
              <p>
                {exercise.answer} <SpeakInline text={exercise.answer} />
              </p>
            </div>
          </div>
        )}
        {answer && (
          <div className="deck-actions">
            <button className="primary-button" onClick={onNext}>
              {session.index + 1 < total ? "Weiter" : "Ergebnis"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ---------- Schreiben ----------
function WritingPractice({ session, onChange, onBack }: { session: WritingSession | null; onChange: (s: WritingSession | null) => void; onBack: () => void }) {
  const { english } = useEnglish();
  const ai = useAiTask();
  const active = english?.units.find((u) => u.status === "active");

  const newTask = async () => {
    if (!english?.level) return;
    const task = await ai.run((signal) => createWritingTask(english.level!, active, english.goal, signal));
    if (task) onChange({ task, text: "", feedback: null });
  };

  const correct = async () => {
    if (!session || !english?.level) return;
    const feedback = await ai.run((signal) => correctWriting(session.task, session.text, english.level!, signal));
    if (feedback) onChange({ ...session, feedback });
  };

  if (ai.busy) return <Busy text={session ? "Die KI korrigiert deinen Text …" : "Die KI überlegt sich eine Aufgabe …"} onAbort={ai.abort} />;

  if (!session) {
    return (
      <>
        <BackLink onBack={onBack} />
        <div className="english-card">
          <h2>
            <PenLine size={20} /> Schreiben üben
          </h2>
          <p className="muted">Du bekommst eine kurze Schreibaufgabe passend zu deinem Niveau{active ? " und deiner Einheit" : ""}.</p>
          {ai.error && <p className="settings-status error">{ai.error}</p>}
          <button className="primary-button" onClick={newTask}>
            Aufgabe holen
          </button>
        </div>
      </>
    );
  }

  const words = session.text.trim() ? session.text.trim().split(/\s+/).length : 0;
  return (
    <>
      <BackLink onBack={onBack} />
      <div className="english-card">
        <h2>Deine Aufgabe</h2>
        <p>{session.task}</p>
        <textarea
          className="english-writing"
          value={session.text}
          onChange={(e) => onChange({ ...session, text: e.target.value, feedback: null })}
          placeholder="Write here …"
          rows={8}
          spellCheck={false}
          autoCapitalize="sentences"
        />
        <p className="muted">{words} Wörter</p>
        {ai.error && <p className="settings-status error">{ai.error}</p>}
        {!session.feedback && (
          <div className="deck-actions">
            <button className="primary-button" onClick={correct} disabled={words < 3}>
              Korrigieren lassen
            </button>
            <button className="text-button" onClick={newTask}>
              Andere Aufgabe
            </button>
          </div>
        )}
      </div>

      {session.feedback && (
        <div className="english-card">
          <h2>Korrektur</h2>
          <p>{session.feedback.summary}</p>
          {session.feedback.mistakes.length === 0 ? (
            <p className="settings-status ok">Keine Fehler gefunden – sehr gut!</p>
          ) : (
            <ul className="writing-mistakes">
              {session.feedback.mistakes.map((m, i) => (
                <li key={i}>
                  <span className="mistake-wrong">{m.wrong}</span> → <span className="mistake-right">{m.right}</span>
                  <div className="muted">{m.why}</div>
                </li>
              ))}
            </ul>
          )}
          <div className="quiz-model">
            <span className="muted">Verbesserter Text</span>
            <p className="writing-corrected">
              {session.feedback.corrected} <SpeakInline text={session.feedback.corrected} />
            </p>
          </div>
          <div className="deck-actions">
            <button className="primary-button" onClick={newTask}>
              Neue Aufgabe
            </button>
            <button className="secondary-button" onClick={() => onChange({ ...session, feedback: null })}>
              Text überarbeiten
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Sprechen ----------
const TOPICS = ["Über mich und mein Studium", "Wochenende & Freizeit", "Reisen", "Im Café / Restaurant bestellen", "Vorstellungsgespräch", "Aktuelle Nachrichten"];

function SpeakingPractice({ session, onChange, onBack }: { session: SpeakingSession | null; onChange: (s: SpeakingSession | null) => void; onBack: () => void }) {
  const { english } = useEnglish();
  const ai = useAiTask();
  const [topic, setTopic] = useState(TOPICS[0]);
  const [input, setInput] = useState("");
  const [autoRead, setAutoRead] = usePersistentState("ui:englishAutoRead", true);
  const speech = useSpeechInput("en-US", setInput);
  const listRef = useRef<HTMLDivElement>(null);

  const ask = async (turns: Turn[], current: SpeakingSession) => {
    if (!english?.level) return;
    const reply = await ai.run((signal) => conversationTurn(english.level!, current.topic, turns, signal));
    if (!reply) return;
    // Korrektur gehört zur letzten eigenen Antwort
    const withCorrection = turns.map((t, i) => (i === turns.length - 1 && t.role === "me" ? { ...t, correction: reply.correction } : t));
    onChange({ ...current, turns: [...withCorrection, { role: "ai", text: reply.reply }] });
    if (autoRead) speak(reply.reply);
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }));
  };

  const startConversation = () => {
    const fresh = { topic, turns: [] };
    onChange(fresh);
    ask([], fresh);
  };

  const send = () => {
    if (!session || !input.trim() || ai.busy) return;
    speech.stop();
    const turns: Turn[] = [...session.turns, { role: "me", text: input.trim() }];
    onChange({ ...session, turns });
    setInput("");
    ask(turns, session);
  };

  if (!session) {
    return (
      <>
        <BackLink onBack={onBack} />
        <div className="english-card">
          <h2>
            <MessagesSquare size={20} /> Sprechen üben
          </h2>
          <p className="muted">
            Ein Gespräch auf Englisch: Die KI antwortet (und liest vor), du antwortest per Mikrofon oder Tastatur. Zu deinen
            Antworten gibt es kurze Korrekturen.
          </p>
          <label className="english-field">
            <span>Thema</span>
            <div className="english-choice">
              {TOPICS.map((t) => (
                <button key={t} className={t === topic ? "selected" : ""} onClick={() => setTopic(t)}>
                  {t}
                </button>
              ))}
            </div>
          </label>
          <button className="primary-button" onClick={startConversation}>
            Gespräch starten
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <BackLink onBack={onBack} />
      <div className="english-card speaking">
        <div className="speaking-head">
          <span className="muted">Thema: {session.topic}</span>
          <label className="speaking-autoread muted">
            <input type="checkbox" checked={autoRead} onChange={(e) => setAutoRead(e.target.checked)} /> vorlesen
          </label>
          <button className="text-button" onClick={() => onChange(null)}>
            Neues Gespräch
          </button>
        </div>
        <div className="speaking-turns" ref={listRef}>
          {session.turns.map((turn, i) => (
            <div key={i} className={`speaking-turn ${turn.role}`}>
              <div className="speaking-bubble">
                {turn.text}
                {turn.role === "ai" && <SpeakInline text={turn.text} />}
              </div>
              {turn.correction && <div className="speaking-correction">✎ {turn.correction}</div>}
            </div>
          ))}
          {ai.busy && (
            <div className="speaking-turn ai">
              <div className="speaking-bubble muted">
                <Loader2 size={14} className="spin" /> …
              </div>
            </div>
          )}
        </div>
        {ai.error && <p className="settings-status error">{ai.error}</p>}
        {speech.error && <p className="settings-status error">{speech.error}</p>}
        <div className="speaking-input">
          {speech.supported && (
            <button
              className={`icon-button speaking-mic ${speech.listening ? "listening" : ""}`}
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
              title={speech.listening ? "Aufnahme beenden" : "Sprechen (Mikrofon)"}
            >
              {speech.listening ? <Square size={16} /> : <Mic size={18} />}
            </button>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={speech.listening ? "Ich höre zu …" : "Antwort auf Englisch (oder Mikrofon / Diktier-Taste) …"}
            rows={2}
            spellCheck={false}
          />
          <button className="icon-button" onClick={send} disabled={!input.trim() || ai.busy} title="Senden (Enter)">
            <Send size={17} />
          </button>
        </div>
      </div>
    </>
  );
}

function SpeakInline({ text }: { text: string }) {
  return (
    <button
      className="icon-button speak-button"
      title="Vorlesen"
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
    >
      <Volume2 size={15} />
    </button>
  );
}
