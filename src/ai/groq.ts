// Verbindung zu Groq (https://groq.com) – sehr schnelle, kostenlos nutzbare KI-Modelle.
// Groq spricht dieselbe Schnittstelle wie OpenAI ("chat/completions"), darum reicht einfaches fetch,
// es braucht kein eigenes Paket. Anfragen gehen direkt vom Gerät an Groq (kein Server dazwischen).
// Grenzen: Groq liest keine eingescannten PDF-Seiten (Bilder) – dafür nimmt die App Gemini.
import type { Attachment, ChatMessage } from "./gemini";
import { parseJson } from "./gemini";

const BASE_URL = "https://api.groq.com/openai/v1";

// Diese Modelle der Reihe nach bevorzugen (gut + gratis). Gibt es keins davon, das erste aus der Liste.
const PREFERRED_MODELS = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b"];
export const DEFAULT_GROQ_MODEL = PREFERRED_MODELS[0];

const SYSTEM_PROMPT = `Du bist der Lernassistent in „Home“, einer persönlichen App fürs Studium.
Antworte auf Deutsch (außer es wird ausdrücklich eine andere Sprache gewünscht), klar und gut gegliedert (Markdown).
Wenn Material (Notiz oder PDF) mitgeschickt wird, stütze dich darauf. Sag ehrlich, wenn etwas nicht im Material steht.
Halte Antworten so kurz wie möglich und so ausführlich wie nötig.`;

// Fehler, den Groq zurückmeldet (mit HTTP-Status, z. B. 401 = Schlüssel falsch, 429 = Limit).
export class GroqError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Message = { role: "system" | "user" | "assistant"; content: string };

// Die "gpt-oss"-Modelle denken vor der Antwort nach; wie viel, lässt sich einstellen.
function reasoningFor(model: string, fast: boolean) {
  return model.startsWith("openai/gpt-oss") ? { reasoning_effort: fast ? "low" : "medium" } : {};
}

async function post(apiKey: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw await errorFrom(response);
  return response;
}

async function errorFrom(response: Response): Promise<GroqError> {
  let message = response.statusText;
  try {
    const data = await response.json();
    message = data?.error?.message ?? message;
  } catch {
    // keine lesbare Fehlermeldung mitgeschickt
  }
  return new GroqError(response.status, message);
}

// Stellt die Frage und liefert die Antwort Stück für Stück (onText), sobald sie entsteht.
export async function askGroq(options: {
  apiKey: string;
  model: string;
  history: ChatMessage[]; // bisheriger Chat inkl. der neuen Frage als letzter Eintrag
  attachment: Attachment | null; // wird nur an die neue Frage gehängt
  onText: (textSoFar: string) => void;
  signal?: AbortSignal;
  fast: boolean;
}): Promise<string> {
  const { apiKey, model, history, attachment, onText, signal, fast } = options;
  if (attachment?.kind === "images") {
    throw new Error("Eingescannte PDF-Seiten kann Groq nicht lesen. Dafür in Einstellungen → KI einen Gemini-Schlüssel eintragen.");
  }
  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((message, index): Message => {
      const isNewQuestion = index === history.length - 1;
      const content =
        isNewQuestion && attachment
          ? `Mitgeschicktes Material: ${attachment.label}\n\n${attachment.text}\n\n---\n\n${message.text}`
          : message.text;
      return { role: message.role, content };
    }),
  ];
  const response = await post(apiKey, { model, messages, stream: true, ...reasoningFor(model, fast) }, signal);

  // Die Antwort kommt als "Server-Sent Events": Zeilen der Form "data: {...}", am Ende "data: [DONE]".
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // letzte, evtl. noch unvollständige Zeile aufheben
    for (const line of lines) {
      const data = line.trim();
      if (!data.startsWith("data:")) continue;
      const payload = data.slice(5).trim();
      if (payload === "[DONE]") continue;
      const chunk = JSON.parse(payload);
      if (chunk.error) throw new GroqError(500, chunk.error.message ?? "Fehler während der Antwort");
      const piece: string | undefined = chunk.choices?.[0]?.delta?.content;
      if (piece) {
        answer += piece;
        onText(answer);
      }
    }
  }
  return answer;
}

// Fragt nach strukturierten Daten (JSON nach einem Schema). Wie bei Gemini werden nacheinander
// einfachere Wege probiert, falls ein Modell eine Art der Anfrage nicht mag:
//   1. festes Antwort-Format mit Schema   2. "nur JSON", Schema im Text   3. normaler Text
export async function askGroqJson<T>(options: {
  apiKey: string;
  model: string;
  prompt: string;
  schema: Record<string, unknown>;
  fast: boolean;
  signal?: AbortSignal;
}): Promise<T> {
  const withSchemaText = `${options.prompt}

Antworte ausschließlich mit gültigem JSON (ohne Erklärungen davor oder danach) nach diesem JSON-Schema:
${JSON.stringify(options.schema)}`;
  const variants = [
    { prompt: options.prompt, format: { type: "json_schema", json_schema: { name: "antwort", schema: options.schema } } },
    { prompt: withSchemaText, format: { type: "json_object" } },
    { prompt: withSchemaText, format: undefined },
  ];

  let lastError: unknown;
  for (const variant of variants) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await post(
          options.apiKey,
          {
            model: options.model,
            messages: [{ role: "user", content: variant.prompt }],
            ...(variant.format && { response_format: variant.format }),
            ...reasoningFor(options.model, options.fast),
          },
          options.signal,
        );
        const data = await response.json();
        return parseJson<T>(data?.choices?.[0]?.message?.content ?? "");
      } catch (error) {
        if (options.signal?.aborted) throw error;
        lastError = error;
        if (error instanceof GroqError) {
          // Minutenlimit mit kurzer Wartezeit: kurz warten und dieselbe Anfrage nochmal.
          const wait = error.status === 429 ? retrySeconds(error.message) : null;
          if (attempt === 0 && wait !== null && wait <= 20 && !/per day/i.test(error.message)) {
            await new Promise((resolve) => setTimeout(resolve, (wait + 0.5) * 1000));
            continue;
          }
          // Schlüssel falsch, Limit erreicht, Modell unbekannt, zu groß: andere Varianten helfen nicht.
          if ([401, 403, 404, 413, 429].includes(error.status)) throw error;
        } else if (error instanceof TypeError && attempt === 0 && navigator.onLine) {
          continue; // Verbindung kurz weg: einmal nochmal versuchen
        } else if (!(error instanceof SyntaxError)) {
          throw error;
        }
        break; // nächste, einfachere Variante
      }
    }
  }
  throw lastError instanceof GroqError
    ? lastError
    : new Error("Die KI hat keine verwertbare Antwort geliefert. Bitte nochmal versuchen.");
}

// Prüft den Schlüssel und liefert die Modelle, mit denen man chatten kann.
export async function listGroqModels(apiKey: string): Promise<string[]> {
  const response = await fetch(`${BASE_URL}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) throw await errorFrom(response);
  const data = await response.json();
  const ids: string[] = (data?.data ?? [])
    .filter((model: { active?: boolean }) => model.active !== false)
    .map((model: { id: string }) => model.id);
  // Sprach-, Audio- und Sicherheitsmodelle weglassen – die können nicht chatten.
  return ids.filter((id) => !/whisper|tts|guard|playai|orpheus|compound|safeguard/i.test(id)).sort();
}

export function pickGroqModel(names: string[]): string | null {
  return PREFERRED_MODELS.find((name) => names.includes(name)) ?? names[0] ?? null;
}

// "Please try again in 1m26.4s" → 86.4
function retrySeconds(message: string): number | null {
  const match = message.match(/try again in (?:(\d+)m)?([\d.]+)s/i);
  return match ? Number(match[1] ?? 0) * 60 + Number(match[2]) : null;
}

// Verständliche Fehlermeldung statt technischem Text.
export function describeGroqError(error: GroqError): string {
  const model = error.message.match(/model `([^`]+)`/)?.[1];
  const forModel = model ? ` für „${model}“` : "";
  if (error.status === 401) return "Der Groq-Schlüssel ist ungültig. Bitte in Einstellungen → KI prüfen.";
  if (error.status === 403) return "Groq lehnt die Anfrage ab (Schlüssel oder Konto). Bitte in Einstellungen → KI prüfen.";
  if (error.status === 404) return "Dieses Groq-Modell gibt es nicht (mehr). Bitte in Einstellungen → KI ein anderes wählen.";
  if (error.status === 413 || /request too large/i.test(error.message)) {
    return "Zu viel Material für eine Anfrage bei Groq. Bitte weniger PDF-Seiten wählen (oder in Einstellungen → KI Gemini nutzen).";
  }
  if (error.status === 429) {
    const seconds = retrySeconds(error.message);
    const wait = seconds === null ? "" : seconds < 90 ? ` in ca. ${Math.ceil(seconds)} Sekunden` : ` in ca. ${Math.ceil(seconds / 60)} Minuten`;
    if (/per day/i.test(error.message)) {
      return `Tageslimit${forModel} erreicht. Wieder möglich${wait || " morgen"} – oder in Einstellungen → KI ein anderes Modell wählen (jedes hat ein eigenes Limit).`;
    }
    return `Minutenlimit${forModel} erreicht – bitte${wait || " kurz"} warten und dann nochmal versuchen.`;
  }
  if (error.status >= 500) return `Groq ist gerade gestört (Fehler ${error.status}). Bitte gleich nochmal versuchen.`;
  return `Fehler von Groq (${error.status}): ${error.message}`;
}
