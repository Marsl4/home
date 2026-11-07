// Aufgaben an die KI für den Englisch-Bereich: Einstufungstest erstellen, auswerten, Lernplan bauen.
// Die KI antwortet jeweils in einem festen Format (JSON-Schema), damit die App es weiterverarbeiten kann.
import { loadAiSettings } from "../../ai/aiConfig";
import { askGeminiJson } from "../../ai/gemini";
import type { EnglishLevel } from "../../storage/db";

export const LEVELS: EnglishLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export type TestQuestion = {
  level: EnglishLevel;
  skill: "grammar" | "vocabulary" | "reading";
  question: string;
  options: string[];
  correctIndex: number;
};

export type PlacementTest = { questions: TestQuestion[]; writingTask: string };

export type Assessment = {
  level: EnglishLevel;
  summary: string;
  strengths: string[];
  weaknesses: string[];
};

export type PlanUnit = {
  title: string;
  goal: string;
  grammar: string;
  vocabulary: { en: string; de: string; example: string }[];
};

function settings() {
  const { apiKey, model, thorough } = loadAiSettings();
  if (!apiKey) throw new Error("Für den Englisch-Bereich brauchst du den KI-Schlüssel (Einstellungen → KI).");
  return { apiKey, model, fast: !thorough };
}

const str = { type: "string" };
const strList = { type: "array", items: str };

// ---------- Einstufungstest ----------
export async function createPlacementTest(goal: string, signal?: AbortSignal): Promise<PlacementTest> {
  const prompt = `Erstelle einen Einstufungstest Englisch für eine deutschsprachige Person.
Ziel der Person: ${goal}.
- 24 Multiple-Choice-Fragen, je genau 4 Antwortmöglichkeiten, genau eine richtig.
- Je 4 Fragen pro Niveau A1, A2, B1, B2, C1, C2, sortiert von leicht nach schwer.
- Gemischt: Grammatik (grammar), Wortschatz (vocabulary) und kurzes Leseverständnis (reading, mit 1–3 Sätzen Text in der Frage).
- Fragen und Antworten auf Englisch; Lücken als "___".
- Die richtige Antwort nicht immer an derselben Stelle.
- writingTask: eine kurze Schreibaufgabe auf Deutsch formuliert ("Schreibe 3–5 Sätze auf Englisch über …"), passend zum Ziel.`;
  const result = await askGeminiJson<PlacementTest>({
    ...settings(),
    prompt,
    signal,
    schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              level: { type: "string", enum: LEVELS },
              skill: { type: "string", enum: ["grammar", "vocabulary", "reading"] },
              question: str,
              options: strList,
              correctIndex: { type: "integer" },
            },
            required: ["level", "skill", "question", "options", "correctIndex"],
          },
        },
        writingTask: str,
      },
      required: ["questions", "writingTask"],
    },
  });
  // Nur brauchbare Fragen übernehmen (4 Antworten, gültige Lösung).
  const questions = (result.questions ?? []).filter(
    (q) => q.options?.length === 4 && q.correctIndex >= 0 && q.correctIndex < 4 && LEVELS.includes(q.level),
  );
  if (questions.length < 8) throw new Error("Der Test konnte nicht erstellt werden. Bitte nochmal versuchen.");
  return { questions, writingTask: result.writingTask || "Schreibe 3–5 Sätze auf Englisch über dich und dein Studium." };
}

// Grobe Einstufung aus den Antworten: das höchste Niveau, bei dem mindestens 3 von 4 richtig waren
// (und alle darunter mindestens zur Hälfte). Die KI bekommt das als Hinweis.
export function estimateLevel(questions: TestQuestion[], answers: (number | null)[]): EnglishLevel {
  let level: EnglishLevel = "A1";
  for (const l of LEVELS) {
    const qs = questions.map((q, i) => ({ q, ok: answers[i] === q.correctIndex })).filter((x) => x.q.level === l);
    if (qs.length === 0) continue;
    const share = qs.filter((x) => x.ok).length / qs.length;
    if (share >= 0.75) level = l;
    else if (share < 0.5) break;
  }
  return level;
}

export async function assess(
  test: PlacementTest,
  answers: (number | null)[],
  writing: string,
  goal: string,
  signal?: AbortSignal,
): Promise<Assessment> {
  const results = test.questions
    .map((q, i) => `${i + 1}. [${q.level}, ${q.skill}] ${q.question} → ${answers[i] === q.correctIndex ? "richtig" : answers[i] === null ? "übersprungen" : `falsch (gewählt: "${q.options[answers[i]!]}", richtig: "${q.options[q.correctIndex]}")`}`)
    .join("\n");
  const prompt = `Werte einen Englisch-Einstufungstest aus (Niveaus nach dem Europäischen Referenzrahmen A1–C2).
Ziel der Person: ${goal}
Ergebnisse der Multiple-Choice-Fragen:
${results}

Schreibaufgabe: ${test.writingTask}
Antwort der Person: ${writing.trim() || "(nichts geschrieben)"}

Grobe Einstufung nach Punkten: ${estimateLevel(test.questions, answers)}.
Bestimme das passende Niveau (berücksichtige auch die Schreibprobe). Antworte auf Deutsch, freundlich und konkret:
summary = 2–4 Sätze Einschätzung; strengths und weaknesses = je 2–4 kurze Punkte (z. B. "Zeitformen der Vergangenheit").`;
  return askGeminiJson<Assessment>({
    ...settings(),
    prompt,
    signal,
    schema: {
      type: "object",
      properties: { level: { type: "string", enum: LEVELS }, summary: str, strengths: strList, weaknesses: strList },
      required: ["level", "summary", "strengths", "weaknesses"],
    },
  });
}

// ---------- Lernplan ----------
export async function createPlan(
  input: { level: EnglishLevel; goal: string; minutesPerDay: number; weaknesses: string[] },
  signal?: AbortSignal,
): Promise<PlanUnit[]> {
  const prompt = `Erstelle einen Englisch-Lernplan für eine deutschsprachige Person.
Aktuelles Niveau: ${input.level}. Ziel: ${input.goal}. Zeit pro Tag: ${input.minutesPerDay} Minuten.
Schwächen laut Einstufungstest: ${input.weaknesses.join("; ") || "keine besonderen"}.
- 8 Einheiten (units), aufeinander aufbauend, Schwächen zuerst, passend zum Ziel; jede Einheit ca. 1 Woche.
- title: kurz, z. B. "Unit 1: Past Simple & Reisen"; goal: was man danach kann (Deutsch, 1 Satz);
  grammar: Grammatik-Schwerpunkt (Deutsch, kurz).
- vocabulary: je 12 nützliche Wörter/Ausdrücke passend zu Niveau, Ziel und Thema der Einheit:
  en (englisch), de (deutsche Bedeutung), example (natürlicher englischer Beispielsatz).
- Keine Wörter doppelt im ganzen Plan; keine zu leichten Wörter für dieses Niveau.`;
  const result = await askGeminiJson<{ units: PlanUnit[] }>({
    ...settings(),
    prompt,
    signal,
    schema: {
      type: "object",
      properties: {
        units: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: str,
              goal: str,
              grammar: str,
              vocabulary: {
                type: "array",
                items: { type: "object", properties: { en: str, de: str, example: str }, required: ["en", "de", "example"] },
              },
            },
            required: ["title", "goal", "grammar", "vocabulary"],
          },
        },
      },
      required: ["units"],
    },
  });
  const units = (result.units ?? []).filter((u) => u.title && u.vocabulary?.length);
  if (units.length === 0) throw new Error("Der Lernplan konnte nicht erstellt werden. Bitte nochmal versuchen.");
  return units;
}
