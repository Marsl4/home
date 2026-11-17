// KI-Aufgaben im Lern-Bereich: Karteikarten aus einer Notiz, einem PDF oder eingefügtem Text erstellen.
import { loadAttachment, type AiSource, type PageRange } from "../../ai/context";
import { askAiJson } from "../../ai/provider";
import type { NewCard } from "./LearnContext";

// So viel Text geht höchstens mit (≈ 5.000 Wörter). Mehr passt bei den Gratis-Anbietern
// oft nicht in eine Anfrage (bei Groq z. B. Tokens pro Minute).
export const MAX_MATERIAL_CHARS = 30_000;

export type Material =
  | { kind: "source"; source: AiSource; range?: PageRange }
  | { kind: "text"; text: string };

// Material als Text holen (Notiz, PDF-Seiten oder eingefügter Text).
export async function materialText(material: Material): Promise<{ label: string; text: string }> {
  if (material.kind === "text") return { label: "Eingefügter Text", text: material.text.trim() };
  const attachment = await loadAttachment(material.source, material.range);
  if (attachment.kind === "images") {
    throw new Error(
      "Diese PDF-Seiten sind eingescannt (Bilder ohne lesbaren Text). Daraus kann die KI hier noch keine Karten machen – bitte Seiten mit Text wählen.",
    );
  }
  return { label: attachment.label, text: attachment.text };
}

export function checkLength(text: string) {
  if (!text.trim()) throw new Error("Das Material ist leer.");
  if (text.length > MAX_MATERIAL_CHARS) {
    throw new Error(
      `Das ist zu viel Material für eine Anfrage (${Math.round(text.length / 1000)}.000 Zeichen, höchstens ${MAX_MATERIAL_CHARS / 1000}.000). Bitte weniger PDF-Seiten wählen oder den Text kürzen.`,
    );
  }
}

export async function createCards(material: Material, count: number, signal?: AbortSignal): Promise<NewCard[]> {
  const { label, text } = await materialText(material);
  checkLength(text);
  const result = await askAiJson<{ cards: NewCard[] }>({
    prompt: `Erstelle ${count} Karteikarten zum Lernen für eine Prüfung an der Uni – aus diesem Material.
Regeln:
- Nur Inhalte aus dem Material, nichts erfinden.
- Die wichtigsten Begriffe, Definitionen, Zusammenhänge, Voraussetzungen und typischen Prüfungsfragen.
- front: eine klare Frage oder ein Begriff (kurz). back: die Antwort, knapp und vollständig (höchstens ca. 3 Sätze
  oder eine kurze Aufzählung mit "- "). **Fett** für Schlüsselbegriffe ist erlaubt.
- Jede Karte für sich verständlich (keine Verweise wie "siehe oben").
- Sprache: wie das Material (meist Deutsch).

Material (${label}):
${text}`,
    signal,
    schema: {
      type: "object",
      properties: {
        cards: {
          type: "array",
          items: {
            type: "object",
            properties: { front: { type: "string" }, back: { type: "string" } },
            required: ["front", "back"],
          },
        },
      },
      required: ["cards"],
    },
  });
  const cards = (result.cards ?? []).filter((c) => c.front?.trim() && c.back?.trim());
  if (cards.length === 0) throw new Error("Die KI hat keine Karten geliefert. Bitte nochmal versuchen.");
  return cards;
}

// ---------- Abfragemodus ----------
export type QuizKind = "open" | "choice";

export type QuizQuestion = {
  question: string;
  answer: string; // Musterantwort (kurz)
  options?: string[]; // nur Multiple Choice: genau 4
  correctIndex?: number; // nur Multiple Choice
  explanation?: string; // nur Multiple Choice: warum richtig
};

export async function createQuiz(material: Material, count: number, kind: QuizKind, signal?: AbortSignal): Promise<QuizQuestion[]> {
  const { label, text } = await materialText(material);
  checkLength(text);
  const str = { type: "string" };
  const choice = kind === "choice";
  const result = await askAiJson<{ questions: QuizQuestion[] }>({
    prompt: `Erstelle ${count} Prüfungsfragen zu diesem Material, um das Wissen einer Studentin / eines Studenten abzufragen.
Regeln:
- Nur Inhalte aus dem Material, nichts erfinden. Von leicht bis anspruchsvoll gemischt; Verständnis statt reines Auswendiglernen.
- question: klare Frage. answer: knappe Musterantwort (1–3 Sätze oder kurze Aufzählung mit "- ").
${choice ? `- options: genau 4 Antwortmöglichkeiten, genau eine richtig (correctIndex 0–3), die falschen plausibel. Die richtige nicht immer an derselben Stelle.
- explanation: 1–2 Sätze, warum die richtige Antwort stimmt.` : "- Offene Fragen (keine Antwortmöglichkeiten vorgeben)."}
- Sprache: wie das Material (meist Deutsch).

Material (${label}):
${text}`,
    signal,
    schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: choice
              ? { question: str, answer: str, options: { type: "array", items: str }, correctIndex: { type: "integer" }, explanation: str }
              : { question: str, answer: str },
            required: choice ? ["question", "answer", "options", "correctIndex"] : ["question", "answer"],
          },
        },
      },
      required: ["questions"],
    },
  });
  const questions = (result.questions ?? []).filter(
    (q) =>
      q.question?.trim() &&
      q.answer?.trim() &&
      (!choice || (q.options?.length === 4 && q.correctIndex !== undefined && q.correctIndex >= 0 && q.correctIndex < 4)),
  );
  if (questions.length === 0) throw new Error("Die KI hat keine Fragen geliefert. Bitte nochmal versuchen.");
  return questions;
}

export type Grade = { result: "right" | "partly" | "wrong"; feedback: string };

// Freie Antwort bewerten – anhand der Musterantwort (das ganze Material muss nicht nochmal mit).
export async function gradeAnswer(question: QuizQuestion, answer: string, signal?: AbortSignal): Promise<Grade> {
  const result = await askAiJson<Grade>({
    prompt: `Bewerte die Antwort auf eine Prüfungsfrage. Sei fair: Es zählt der Inhalt, nicht die Formulierung.
Frage: ${question.question}
Musterantwort: ${question.answer}
Antwort der Person: ${answer.trim() || "(keine Antwort)"}

result: "right" (inhaltlich richtig und im Wesentlichen vollständig), "partly" (teilweise richtig / Wichtiges fehlt)
oder "wrong" (falsch oder keine Antwort).
feedback: 1–3 Sätze auf Deutsch, direkt an die Person ("du"): was gut war, was fehlt oder falsch ist.`,
    signal,
    schema: {
      type: "object",
      properties: { result: { type: "string", enum: ["right", "partly", "wrong"] }, feedback: { type: "string" } },
      required: ["result", "feedback"],
    },
  });
  const valid = ["right", "partly", "wrong"].includes(result.result);
  return { result: valid ? result.result : "partly", feedback: result.feedback || "" };
}
