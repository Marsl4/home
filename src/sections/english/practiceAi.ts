// KI-Aufgaben für "Üben" im Englisch-Bereich: Grammatik-Übungen, Schreiben mit Korrektur, Gespräch.
// Alle Erklärungen auf Deutsch, die Übungen selbst auf Englisch.
import { askAiJson } from "../../ai/provider";
import type { EnglishLevel, EnglishUnit } from "../../storage/db";

const str = { type: "string" };

// ---------- Grammatik ----------
export type GrammarExercise = {
  kind: "choice" | "write";
  task: string; // Aufgabe auf Deutsch, z. B. "Setze die richtige Zeitform ein" / "Übersetze ins Englische"
  sentence: string; // englischer Satz mit Lücke "___" bzw. deutscher Satz zum Übersetzen
  options?: string[]; // nur choice: genau 4
  correctIndex?: number; // nur choice
  answer: string; // richtige Lösung (bei write: eine gute Musterlösung)
  explanation: string; // kurze Regel/Erklärung auf Deutsch
};

export async function createGrammarExercises(level: EnglishLevel, unit: EnglishUnit, goal: string, signal?: AbortSignal) {
  const result = await askAiJson<{ exercises: GrammarExercise[] }>({
    prompt: `Erstelle 8 Grammatik-Übungen Englisch für eine deutschsprachige Person auf Niveau ${level}.
Thema der Einheit: ${unit.title}. Grammatik-Schwerpunkt: ${unit.grammar}. Lernziel der Person: ${goal}.
- Gemischt: 4× kind "choice" (englischer Satz mit Lücke "___", genau 4 Antwortmöglichkeiten, correctIndex 0–3, nur eine richtig)
  und 4× kind "write" (abwechselnd: Lücke selbst ausfüllen, oder einen kurzen deutschen Satz ins Englische übersetzen).
- task: kurze Arbeitsanweisung auf Deutsch. sentence: der Satz. answer: richtige Lösung (bei Übersetzung eine natürliche Musterlösung).
- explanation: 1–2 Sätze auf Deutsch, welche Regel gilt.
- Von leichter zu schwerer, passend zum Niveau und Thema; Alltags- bzw. zielnahe Beispiele.`,
    signal,
    schema: {
      type: "object",
      properties: {
        exercises: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["choice", "write"] },
              task: str,
              sentence: str,
              options: { type: "array", items: str },
              correctIndex: { type: "integer" },
              answer: str,
              explanation: str,
            },
            required: ["kind", "task", "sentence", "answer", "explanation"],
          },
        },
      },
      required: ["exercises"],
    },
  });
  const exercises = (result.exercises ?? []).filter(
    (e) =>
      e.sentence?.trim() &&
      e.answer?.trim() &&
      (e.kind === "write" || (e.kind === "choice" && e.options?.length === 4 && e.correctIndex! >= 0 && e.correctIndex! < 4)),
  );
  if (exercises.length < 3) throw new Error("Die Übungen konnten nicht erstellt werden. Bitte nochmal versuchen.");
  return exercises;
}

export type EnglishGrade = { correct: boolean; feedback: string };

export async function gradeEnglishAnswer(exercise: GrammarExercise, answer: string, signal?: AbortSignal): Promise<EnglishGrade> {
  const result = await askAiJson<EnglishGrade>({
    prompt: `Bewerte die Antwort einer deutschsprachigen Person auf eine Englisch-Grammatikübung.
Aufgabe: ${exercise.task}
Satz: ${exercise.sentence}
Musterlösung: ${exercise.answer}
Antwort der Person: ${answer.trim() || "(keine Antwort)"}
correct: true, wenn grammatisch richtig und sinngemäß passend (andere korrekte Formulierungen zählen auch; kleine Tippfehler nicht streng werten).
feedback: 1–2 Sätze auf Deutsch, direkt an die Person ("du"): was stimmt bzw. was der Fehler ist und warum.`,
    signal,
    schema: { type: "object", properties: { correct: { type: "boolean" }, feedback: str }, required: ["correct", "feedback"] },
  });
  return { correct: result.correct === true, feedback: result.feedback ?? "" };
}

// ---------- Schreiben ----------
export async function createWritingTask(level: EnglishLevel, unit: EnglishUnit | undefined, goal: string, signal?: AbortSignal): Promise<string> {
  const result = await askAiJson<{ task: string }>({
    prompt: `Formuliere eine kurze Schreibaufgabe Englisch für eine deutschsprachige Person auf Niveau ${level}.
Lernziel: ${goal}.${unit ? ` Thema der aktuellen Einheit: ${unit.title} (Grammatik: ${unit.grammar}) – die Aufgabe soll diese Grammatik nutzen.` : ""}
task: auf Deutsch, 1–3 Sätze, mit Umfang (z. B. "Schreibe 5–8 Sätze auf Englisch über …").`,
    signal,
    schema: { type: "object", properties: { task: str }, required: ["task"] },
  });
  return result.task?.trim() || "Schreibe 5–8 Sätze auf Englisch über deine letzte Woche.";
}

export type WritingFeedback = {
  corrected: string; // verbesserter Text
  mistakes: { wrong: string; right: string; why: string }[];
  summary: string; // Gesamteindruck auf Deutsch
};

export async function correctWriting(task: string, text: string, level: EnglishLevel, signal?: AbortSignal): Promise<WritingFeedback> {
  const result = await askAiJson<WritingFeedback>({
    prompt: `Korrigiere einen englischen Text einer deutschsprachigen Person (Niveau ${level}).
Aufgabe war: ${task}
Text der Person:
${text}

corrected: der Text mit allen Fehlern verbessert (so nah wie möglich am Original, natürliches Englisch).
mistakes: jeder Fehler einzeln – wrong (Original-Stelle), right (Verbesserung), why (kurze Erklärung auf Deutsch). Leere Liste, wenn fehlerfrei.
summary: 2–3 Sätze auf Deutsch, direkt an die Person ("du"): was schon gut ist und worauf sie achten sollte.`,
    signal,
    schema: {
      type: "object",
      properties: {
        corrected: str,
        mistakes: { type: "array", items: { type: "object", properties: { wrong: str, right: str, why: str }, required: ["wrong", "right", "why"] } },
        summary: str,
      },
      required: ["corrected", "mistakes", "summary"],
    },
  });
  return { corrected: result.corrected ?? text, mistakes: result.mistakes ?? [], summary: result.summary ?? "" };
}

// ---------- Sprechen (Gespräch) ----------
export type Turn = { role: "ai" | "me"; text: string; correction?: string };

export type ConversationReply = {
  correction: string; // kurze Korrektur der letzten Antwort auf Deutsch ("" wenn fehlerfrei)
  reply: string; // Antwort der KI auf Englisch (mit einer Frage, damit das Gespräch weitergeht)
};

export async function conversationTurn(level: EnglishLevel, topic: string, history: Turn[], signal?: AbortSignal): Promise<ConversationReply> {
  const transcript = history.map((t) => `${t.role === "ai" ? "Partner" : "Person"}: ${t.text}`).join("\n");
  const result = await askAiJson<ConversationReply>({
    prompt: `Du bist ein freundlicher Gesprächspartner, mit dem eine deutschsprachige Person (Niveau ${level}) Englisch sprechen übt.
Thema: ${topic}
${transcript ? `Bisheriges Gespräch:\n${transcript}\n` : "Das Gespräch beginnt gerade."}
reply: deine nächste Antwort auf Englisch – kurz (1–3 Sätze), natürlich, passend zum Niveau, endet meist mit einer Frage.
correction: ${history.some((t) => t.role === "me") ? "kurze Korrektur der LETZTEN Antwort der Person auf Deutsch (Fehler + bessere Formulierung), leer lassen wenn sie gut war." : 'leer lassen ("").'}`,
    signal,
    schema: { type: "object", properties: { correction: str, reply: str }, required: ["correction", "reply"] },
  });
  return { correction: result.correction?.trim() ?? "", reply: result.reply?.trim() || "Could you tell me more?" };
}
