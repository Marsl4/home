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
