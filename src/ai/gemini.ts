// Verbindung zu Google Gemini (offizielles Paket @google/genai).
// Die App schickt Anfragen direkt vom Gerät an Google – es gibt keinen eigenen Server dazwischen.
// Alles Anbieter-Spezifische steht nur hier: Kommt später z. B. Claude dazu, reicht eine zweite Datei.
import { ApiError, GoogleGenAI, ThinkingLevel, type Content, type Part, type ThinkingConfig } from "@google/genai";

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  attached?: string; // nur zur Anzeige: welches Material mitgeschickt wurde
};

// Material, das zur aktuellen Frage mitgeschickt wird (Notiz als Text oder PDF).
export type Attachment =
  | { kind: "text"; label: string; text: string }
  | { kind: "images"; label: string; images: string[] }; // eingescannte Seiten als JPEG (Base64)

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
  fast: boolean; // wenig "Nachdenken" vor der Antwort (schneller)
};

// Wie viel die KI vor der Antwort nachdenkt. Ältere Modelle (2.x) nehmen ein Budget,
// neuere (ab 3) eine Stufe. Kennt ein Modell die Einstellung nicht, wird ohne gefragt.
function thinkingFor(model: string, fast: boolean): ThinkingConfig | undefined {
  if (!fast) return undefined;
  if (/^gemini-[12]\./.test(model)) return { thinkingBudget: model.includes("pro") ? 128 : 0 };
  return { thinkingLevel: ThinkingLevel.LOW };
}

// Stellt die Frage und liefert die Antwort Stück für Stück (onText), sobald sie entsteht.
export async function askGemini({ apiKey, model, history, attachment, onText, signal, fast }: AskOptions) {
  const ai = new GoogleGenAI({ apiKey });
  const contents: Content[] = history.map((message, index) => {
    const parts: Part[] = [{ text: message.text }];
    if (index === history.length - 1 && attachment) parts.unshift(...attachmentParts(attachment));
    return { role: message.role === "user" ? "user" : "model", parts };
  });

  const request = (thinkingConfig: ThinkingConfig | undefined) =>
    ai.models.generateContentStream({
      model,
      contents,
      config: { systemInstruction: SYSTEM_PROMPT, abortSignal: signal, ...(thinkingConfig && { thinkingConfig }) },
    });
  const thinking = thinkingFor(model, fast);
  let stream;
  try {
    stream = await request(thinking);
  } catch (error) {
    // Modell mag die Denk-Einstellung nicht -> einfach ohne nochmal
    if (!thinking || !(error instanceof ApiError) || error.status !== 400 || !/think/i.test(error.message)) throw error;
    stream = await request(undefined);
  }
  let answer = "";
  for await (const chunk of stream) {
    answer += chunk.text ?? "";
    onText(answer);
  }
  return answer;
}

function attachmentParts(attachment: Attachment): Part[] {
  if (attachment.kind === "images") {
    return [
      { text: `Mitgeschicktes Material: ${attachment.label} (eingescannte Seiten als Bilder)` },
      ...attachment.images.map((data) => ({ inlineData: { mimeType: "image/jpeg", data } })),
    ];
  }
  return [{ text: `Mitgeschicktes Material: ${attachment.label}\n\n${attachment.text}` }];
}

// Fragt die KI nach strukturierten Daten (JSON nach einem Schema), z. B. für Tests oder Lernpläne.
// Nicht jedes Modell kommt mit jeder Art der Anfrage zurecht (manche brechen mit "500" ab).
// Darum werden nacheinander einfachere Wege probiert:
//   1. festes Antwort-Format mit Schema
//   2. nur "antworte als JSON", das Schema steht im Text
//   3. ganz normale Textantwort, aus der das JSON herausgesucht wird
export async function askGeminiJson<T>(options: {
  apiKey: string;
  model: string;
  prompt: string;
  schema: Record<string, unknown>; // JSON-Schema der Antwort
  fast: boolean;
  signal?: AbortSignal;
}): Promise<T> {
  const ai = new GoogleGenAI({ apiKey: options.apiKey });
  const withSchemaText = `${options.prompt}

Antworte ausschließlich mit gültigem JSON (ohne Erklärungen davor oder danach) nach diesem JSON-Schema:
${JSON.stringify(options.schema)}`;
  const variants = [
    { prompt: options.prompt, config: { responseMimeType: "application/json", responseJsonSchema: options.schema } },
    { prompt: withSchemaText, config: { responseMimeType: "application/json" } },
    { prompt: withSchemaText, config: {} },
  ];

  let lastError: unknown;
  for (const variant of variants) {
    // includeThoughts: Die KI schickt beim Nachdenken kurze Zwischenstände mit. Die App zeigt sie
    // nicht an (chunk.text lässt sie weg), aber so fließen von Anfang an Daten und Safari bricht
    // die Verbindung nicht ab, während die KI noch nachdenkt.
    let thinking: ThinkingConfig | undefined = { ...thinkingFor(options.model, options.fast), includeThoughts: true };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Als "Stream" abrufen, also Stück für Stück: Lange Antworten (z. B. ein ganzer Lernplan)
        // brauchen oft über eine Minute. Kommt so lange gar nichts an, bricht Safari die Verbindung
        // mit "Load failed" ab. Beim Stream fließen laufend Daten, dann passiert das nicht.
        const stream = await ai.models.generateContentStream({
          model: options.model,
          contents: [{ role: "user", parts: [{ text: variant.prompt }] }],
          config: { abortSignal: options.signal, ...variant.config, ...(thinking && { thinkingConfig: thinking }) },
        });
        let text = "";
        for await (const chunk of stream) text += chunk.text ?? "";
        return parseJson<T>(text);
      } catch (error) {
        if (options.signal?.aborted) throw error;
        lastError = error;
        if (error instanceof ApiError) {
          // Modell mag die Denk-Einstellung nicht: gleiche Variante ohne.
          if (thinking && error.status === 400 && /think/i.test(error.message)) {
            thinking = undefined;
            continue;
          }
          // Schlüssel falsch, Limit erreicht, Modell unbekannt: andere Varianten helfen nicht.
          if ([401, 403, 404, 429].includes(error.status)) throw error;
        } else if (!(error instanceof SyntaxError)) {
          throw error; // z. B. keine Verbindung
        }
        break; // nächste, einfachere Variante
      }
    }
  }
  throw lastError instanceof ApiError
    ? lastError
    : new Error("Die KI hat keine verwertbare Antwort geliefert. Bitte nochmal versuchen.");
}

// JSON aus einer Antwort holen – auch wenn es in ```json … ``` steht oder Text drumherum ist.
function parseJson<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start === -1 || end <= start) throw new SyntaxError("Kein JSON in der Antwort");
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  }
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

// Sucht aus den verfügbaren Modellen ein passendes aus: das neueste normale "Flash"-Modell
// (schnell und gratis), ohne Sonderversionen wie "lite", "preview" oder "image".
export function pickModel(names: string[]): string | null {
  const plainFlash = names
    .filter((n) => /^gemini-[\d.]+-flash$/.test(n))
    .sort((a, b) => parseFloat(b.slice(7)) - parseFloat(a.slice(7)));
  if (plainFlash[0]) return plainFlash[0];
  if (names.includes("gemini-flash-latest")) return "gemini-flash-latest";
  const anyFlash = names.find((n) => n.includes("flash") && !/lite|image|tts|live|audio/.test(n));
  return anyFlash ?? names[0] ?? null;
}

// Falls die Modell-Liste nicht abrufbar ist: diese Namen der Reihe nach probieren.
export const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];

// Gibt es das eingestellte Modell nicht (mehr)?
export function isModelMissing(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

// Verständliche Fehlermeldung statt technischem Text.
// withAttachment: false, wenn es kein mitgeschicktes Material gibt (z. B. im Englisch-Bereich).
export function describeAiError(error: unknown, { withAttachment = true } = {}): string {
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
    if (error.status === 503) return "Google ist gerade überlastet. Bitte gleich nochmal versuchen.";
    if (error.status >= 500)
      return `Google konnte die Anfrage nicht bearbeiten (Fehler ${error.status}). Tipp: in Einstellungen → KI ein anderes Modell wählen. (Technisch: ${error.message.slice(0, 160)})`;
    return `Fehler von Gemini (${error.status}): ${error.message}`;
  }
  // "Load failed" (Safari) / "Failed to fetch" (Chrome): Die Anfrage kam gar nicht bei Google an
  // oder die Verbindung brach ab – z. B. durch einen Werbe-/Inhaltsblocker oder eine zu große Datei.
  if (error instanceof TypeError && /load failed|failed to fetch|network/i.test(error.message)) {
    if (!withAttachment) {
      return (
        "Die Verbindung zu Google ist abgebrochen. Mögliche Gründe: ein Werbe- oder Inhaltsblocker in Safari " +
        `oder eine wackelige Verbindung. Bitte nochmal versuchen. (Technisch: ${error.message})`
      );
    }
    return (
      "Die Verbindung zu Google ist fehlgeschlagen. Mögliche Gründe: ein Werbe- oder Inhaltsblocker " +
      "in Safari, zu viel mitgeschicktes Material (dann weniger PDF-Seiten wählen) oder eine wackelige Verbindung. " +
      `Tipp: Frage einmal ohne Häkchen bei „Wird mitgeschickt“ stellen. (Technisch: ${error.message})`
    );
  }
  return `Fehler: ${error instanceof Error ? error.message : String(error)}`;
}
