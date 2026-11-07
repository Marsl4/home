// Verbindung zu Google Gemini (offizielles Paket @google/genai).
// Die App schickt Anfragen direkt vom Gerät an Google – es gibt keinen eigenen Server dazwischen.
// Alles Anbieter-Spezifische steht nur hier: Kommt später z. B. Claude dazu, reicht eine zweite Datei.
import { ApiError, GoogleGenAI, type Content, type Part } from "@google/genai";

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  attached?: string; // nur zur Anzeige: welches Material mitgeschickt wurde
};

// Material, das zur aktuellen Frage mitgeschickt wird (Notiz als Text oder PDF).
export type Attachment =
  | { kind: "text"; label: string; text: string }
  | { kind: "pdf"; label: string; base64: string };

const SYSTEM_PROMPT = `Du bist der Lernassistent in „Home“, einer persönlichen App fürs Studium.
Antworte auf Deutsch (außer es wird ausdrücklich eine andere Sprache gewünscht), klar und gut gegliedert.
Wenn Material (Notiz oder PDF) mitgeschickt wird, stütze dich darauf. Sag ehrlich, wenn etwas nicht im Material steht.
Halte Antworten so kurz wie möglich und so ausführlich wie nötig.`;

type AskOptions = {
  apiKey: string;
  model: string;
  history: ChatMessage[]; // bisheriger Chat inkl. der neuen Frage als letzter Eintrag
  attachment: Attachment | null; // wird nur an die neue Frage gehängt
  onText: (textSoFar: string) => void;
  signal?: AbortSignal;
};

// Stellt die Frage und liefert die Antwort Stück für Stück (onText), sobald sie entsteht.
export async function askGemini({ apiKey, model, history, attachment, onText, signal }: AskOptions) {
  const ai = new GoogleGenAI({ apiKey });
  const contents: Content[] = history.map((message, index) => {
    const parts: Part[] = [{ text: message.text }];
    if (index === history.length - 1 && attachment) parts.unshift(...attachmentParts(attachment));
    return { role: message.role === "user" ? "user" : "model", parts };
  });

  const stream = await ai.models.generateContentStream({
    model,
    contents,
    config: { systemInstruction: SYSTEM_PROMPT, abortSignal: signal },
  });
  let answer = "";
  for await (const chunk of stream) {
    answer += chunk.text ?? "";
    onText(answer);
  }
  return answer;
}

function attachmentParts(attachment: Attachment): Part[] {
  if (attachment.kind === "pdf") {
    return [
      { text: `Mitgeschicktes Material: PDF „${attachment.label}“` },
      { inlineData: { mimeType: "application/pdf", data: attachment.base64 } },
    ];
  }
  return [{ text: `Mitgeschicktes Material: ${attachment.label}\n\n${attachment.text}` }];
}

// Prüft den Schlüssel und liefert die Modelle, die Text erzeugen können.
export async function listGeminiModels(apiKey: string): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey });
  const names: string[] = [];
  for await (const model of await ai.models.list()) {
    const name = model.name?.replace(/^models\//, "");
    if (name?.startsWith("gemini") && model.supportedActions?.includes("generateContent")) {
      names.push(name);
    }
  }
  return names.sort();
}

// Verständliche Fehlermeldung statt technischem Text.
export function describeAiError(error: unknown): string {
  if (!navigator.onLine) return "Keine Internetverbindung – die KI braucht Internet.";
  if (error instanceof ApiError) {
    if (error.status === 400 && /api key/i.test(error.message))
      return "Der API-Schlüssel ist ungültig. Bitte in Einstellungen → KI prüfen.";
    if (error.status === 401 || error.status === 403)
      return "Der API-Schlüssel wird nicht akzeptiert. Bitte in Einstellungen → KI prüfen.";
    if (error.status === 404)
      return "Dieses Modell gibt es nicht (mehr). Bitte in Einstellungen → KI ein anderes wählen.";
    if (error.status === 429)
      return "Gratis-Limit erreicht – bitte kurz warten (meist eine Minute) und dann nochmal versuchen.";
    if (error.status >= 500) return "Google ist gerade überlastet. Bitte gleich nochmal versuchen.";
    return `Fehler von Gemini (${error.status}): ${error.message}`;
  }
  return `Fehler: ${error instanceof Error ? error.message : String(error)}`;
}
