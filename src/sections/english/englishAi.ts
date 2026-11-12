// Aufgaben an die KI für den Englisch-Bereich: Einstufungstest erstellen, auswerten, Lernplan bauen.
// Die KI antwortet jeweils in einem festen Format (JSON-Schema), damit die App es weiterverarbeiten kann.
import { askAiJson } from "../../ai/provider";
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

const str = { type: "string" };
const strList = { type: "array", items: str };

// ---------- Einstufungstest ----------
// Der Test wird in 3 kleinen Anfragen gleichzeitig erstellt (je 2 Niveaus mit 8 Fragen).
// Eine einzige große Anfrage dauert zu lange – Safari bricht nach ca. 50–60 s ab ("Load failed").
const TEST_PARTS: EnglishLevel[][] = [
  ["A1", "A2"],
  ["B1", "B2"],
  ["C1", "C2"],
];

const questionSchema = {
  type: "object",
  properties: {
    level: { type: "string", enum: LEVELS },
    skill: { type: "string", enum: ["grammar", "vocabulary", "reading"] },
    question: str,
    options: strList,
    correctIndex: { type: "integer" },
  },
  required: ["level", "skill", "question", "options", "correctIndex"],
};

// withWritingTask: Der erste Teil liefert auch die Schreibaufgabe mit (spart eine Anfrage –
// im Gratis-Tarif gibt es nur wenige Anfragen pro Tag).
async function createTestPart(
  goal: string,
  levels: EnglishLevel[],
  withWritingTask: boolean,
  signal?: AbortSignal,
): Promise<{ questions: TestQuestion[]; writingTask?: string }> {
  const prompt = `Erstelle einen Teil eines Einstufungstests Englisch für eine deutschsprachige Person.
Ziel der Person: ${goal}.
- Genau 4 Multiple-Choice-Fragen pro Niveau, nur für diese Niveaus: ${levels.join(", ")} (also ${levels.length * 4} Fragen), sortiert von leicht nach schwer.
- Je genau 4 Antwortmöglichkeiten, genau eine richtig.
- Gemischt: Grammatik (grammar), Wortschatz (vocabulary) und kurzes Leseverständnis (reading, mit 1–3 Sätzen Text in der Frage).
- Fragen und Antworten auf Englisch; Lücken als "___".
- Die richtige Antwort nicht immer an derselben Stelle.${
    withWritingTask
      ? `\n- writingTask: eine kurze Schreibaufgabe auf Deutsch formuliert ("Schreibe 3–5 Sätze auf Englisch über …"), passend zum Ziel.`
      : ""
  }`;
  const result = await askAiJson<{ questions: TestQuestion[]; writingTask?: string }>({
    prompt,
    signal,
    schema: {
      type: "object",
      properties: {
        questions: { type: "array", items: questionSchema },
        ...(withWritingTask && { writingTask: str }),
      },
      required: withWritingTask ? ["questions", "writingTask"] : ["questions"],
    },
  });
  return { questions: result.questions ?? [], writingTask: result.writingTask };
}

export async function createPlacementTest(goal: string, signal?: AbortSignal): Promise<PlacementTest> {
  const parts = await Promise.all(TEST_PARTS.map((levels, i) => createTestPart(goal, levels, i === 0, signal)));
  // Nur brauchbare Fragen übernehmen (4 Antworten, gültige Lösung), nach Niveau sortiert.
  const questions = parts
    .flatMap((part) => part.questions)
    .filter((q) => q.options?.length === 4 && q.correctIndex >= 0 && q.correctIndex < 4 && LEVELS.includes(q.level))
    .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
  if (questions.length < 8) throw new Error("Der Test konnte nicht erstellt werden. Bitte nochmal versuchen.");
  return {
    questions,
    writingTask: parts[0].writingTask || "Schreibe 3–5 Sätze auf Englisch über dich und dein Studium.",
  };
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
  return askAiJson<Assessment>({
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
// In zwei Schritten, damit keine Anfrage zu lange dauert (Safari bricht nach ca. 50–60 s ab):
//   1. Gliederung: 8 Einheiten mit Titel, Ziel und Grammatik (kurze Antwort)
//   2. Vokabeln: 4 Anfragen gleichzeitig, je 2 Einheiten mit 12 Wörtern
type UnitOutline = Omit<PlanUnit, "vocabulary">;
const UNITS_PER_VOCAB_REQUEST = 2;

const vocabSchema = {
  type: "array",
  items: { type: "object", properties: { en: str, de: str, example: str }, required: ["en", "de", "example"] },
};

export async function createPlan(
  input: { level: EnglishLevel; goal: string; minutesPerDay: number; weaknesses: string[] },
  signal?: AbortSignal,
): Promise<PlanUnit[]> {
  const about = `Aktuelles Niveau: ${input.level}. Ziel: ${input.goal}. Zeit pro Tag: ${input.minutesPerDay} Minuten.
Schwächen laut Einstufungstest: ${input.weaknesses.join("; ") || "keine besonderen"}.`;

  // Schritt 1: Gliederung
  const outline = await askAiJson<{ units: UnitOutline[] }>({
    prompt: `Erstelle die Gliederung eines Englisch-Lernplans für eine deutschsprachige Person.
${about}
- 8 Einheiten (units), aufeinander aufbauend, Schwächen zuerst, passend zum Ziel; jede Einheit ca. 1 Woche.
- title: kurz, z. B. "Unit 1: Past Simple & Reisen"; goal: was man danach kann (Deutsch, 1 Satz);
  grammar: Grammatik-Schwerpunkt (Deutsch, kurz).`,
    signal,
    schema: {
      type: "object",
      properties: {
        units: {
          type: "array",
          items: { type: "object", properties: { title: str, goal: str, grammar: str }, required: ["title", "goal", "grammar"] },
        },
      },
      required: ["units"],
    },
  });
  const units = (outline.units ?? []).filter((u) => u.title);
  if (units.length === 0) throw new Error("Der Lernplan konnte nicht erstellt werden. Bitte nochmal versuchen.");

  // Schritt 2: Vokabeln, mehrere Einheiten gleichzeitig
  const allTitles = units.map((u) => u.title).join("; ");
  const groups: UnitOutline[][] = [];
  for (let i = 0; i < units.length; i += UNITS_PER_VOCAB_REQUEST) groups.push(units.slice(i, i + UNITS_PER_VOCAB_REQUEST));
  const vocabGroups = await Promise.all(
    groups.map(async (group) => {
      const result = await askAiJson<{ units: { vocabulary: PlanUnit["vocabulary"] }[] }>({
        prompt: `Erstelle Vokabeln für einen Englisch-Lernplan einer deutschsprachigen Person.
${about}
Alle Einheiten des Plans (nur zur Orientierung, damit sich nichts doppelt): ${allTitles}
Erstelle Vokabeln NUR für diese ${group.length} Einheit(en), in dieser Reihenfolge:
${group.map((u, i) => `${i + 1}. ${u.title} – ${u.goal}`).join("\n")}
- Pro Einheit genau 12 nützliche Wörter/Ausdrücke passend zu Niveau, Ziel und Thema der Einheit:
  en (englisch), de (deutsche Bedeutung), example (natürlicher englischer Beispielsatz).
- Keine zu leichten Wörter für dieses Niveau, keine Wörter doppelt.`,
        signal,
        schema: {
          type: "object",
          properties: {
            units: { type: "array", items: { type: "object", properties: { vocabulary: vocabSchema }, required: ["vocabulary"] } },
          },
          required: ["units"],
        },
      });
      return group.map((_, i) => result.units?.[i]?.vocabulary ?? []);
    }),
  );

  // Zusammensetzen; Wörter, die schon in einer früheren Einheit vorkommen, weglassen.
  const seen = new Set<string>();
  const plan = units.map((unit, i) => {
    const vocabulary = (vocabGroups.flat()[i] ?? []).filter((v) => {
      const key = v.en?.trim().toLowerCase();
      if (!key || !v.de || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { ...unit, vocabulary };
  });
  const usable = plan.filter((u) => u.vocabulary.length > 0);
  if (usable.length === 0) throw new Error("Der Lernplan konnte nicht erstellt werden. Bitte nochmal versuchen.");
  return usable;
}
