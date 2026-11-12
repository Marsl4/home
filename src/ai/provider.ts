// Wählt je nach Einstellung den KI-Anbieter (Groq oder Google Gemini).
// Der Rest der App fragt hier – so muss z. B. der Englisch-Bereich nichts über die Anbieter wissen.
import { ApiError } from "@google/genai";

import { loadAiSettings, type AiProvider, type AiSettings } from "./aiConfig";
import { askGeminiJson, describeGeminiError } from "./gemini";
import { askGroqJson, DEFAULT_GROQ_MODEL, describeGroqError, GroqError } from "./groq";

export function activeProvider(settings: AiSettings): AiProvider {
  return settings.provider ?? "gemini";
}

// Schlüssel und Modell des gewählten Anbieters.
export function activeAccess(settings: AiSettings): { provider: AiProvider; apiKey: string; model: string } {
  if (activeProvider(settings) === "groq") {
    return { provider: "groq", apiKey: settings.groqKey ?? "", model: settings.groqModel ?? DEFAULT_GROQ_MODEL };
  }
  return { provider: "gemini", apiKey: settings.apiKey, model: settings.model };
}

export function providerName(provider: AiProvider): string {
  return provider === "groq" ? "Groq" : "Gemini";
}

// Strukturierte Antwort (JSON nach Schema) vom gewählten Anbieter.
export async function askAiJson<T>(options: {
  prompt: string;
  schema: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<T> {
  const settings = loadAiSettings();
  const { provider, apiKey, model } = activeAccess(settings);
  if (!apiKey) {
    throw new Error(`Dafür brauchst du einen ${providerName(provider)}-Schlüssel (Einstellungen → KI).`);
  }
  const request = { ...options, apiKey, model, fast: !settings.thorough };
  return provider === "groq" ? askGroqJson<T>(request) : askGeminiJson<T>(request);
}

// Ist das ein Fehler vom KI-Dienst bzw. der Verbindung (dann describeAiError nutzen)?
export function isAiServiceError(error: unknown): boolean {
  return error instanceof ApiError || error instanceof GroqError || error instanceof TypeError;
}

// Verständliche Fehlermeldung – egal von welchem Anbieter.
// withAttachment: false, wenn es kein mitgeschicktes Material gibt (z. B. im Englisch-Bereich).
export function describeAiError(error: unknown, options: { withAttachment?: boolean } = {}): string {
  if (navigator.onLine && error instanceof GroqError) return describeGroqError(error);
  return describeGeminiError(error, options);
}
