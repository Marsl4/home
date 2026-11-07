// KI-Leiste rechts: Chat mit Gemini. Kennt die Notiz bzw. das PDF der aktiven Hälfte
// und schickt sie (wenn gewünscht) mit der Frage mit.
import { useRef, useState } from "react";
import { Copy, FileText, NotebookPen, Send, Sparkles, Square, Trash2, X } from "lucide-react";

import { showToast } from "../components/toast";
import { useNotes } from "../sections/notes/NotesContext";
import { usePdfs } from "../sections/pdfs/PdfsContext";
import { usePersistentState } from "../storage/uiState";
import { AiMarkdown } from "./AiMarkdown";
import { saveAiSettings, useAiSettings } from "./aiConfig";
import { findSource, loadAttachment } from "./context";
import {
  askGemini,
  describeAiError,
  FALLBACK_MODELS,
  isModelMissing,
  listGeminiModels,
  pickModel,
  type ChatMessage,
} from "./gemini";

// Schnell-Aktionen für das mitgeschickte Material.
const QUICK_ACTIONS = [
  {
    label: "Zusammenfassen",
    prompt: "Fasse das Material übersichtlich zusammen: die wichtigsten Begriffe, Definitionen und Zusammenhänge.",
  },
  {
    label: "Einfach erklären",
    prompt: "Erkläre die Kernaussagen des Materials so einfach wie möglich, mit anschaulichen Beispielen.",
  },
  {
    label: "Abfragen",
    prompt:
      "Frag mich zum Material ab: Stell mir genau eine Frage und warte auf meine Antwort. Bewerte meine Antwort dann kurz und stell die nächste Frage.",
  },
  {
    label: "Karteikarten",
    prompt:
      "Erstelle 10 Karteikarten zu den wichtigsten Inhalten des Materials. Format je Karte: **Vorderseite:** … / **Rückseite:** …",
  },
];

type Props = {
  sectionId: string; // Bereich der aktiven Hälfte
  selectedId: string | null; // was dort offen ist
  onClose: () => void;
  onOpenSettings: () => void;
};

export function AiSidebar({ sectionId, selectedId, onClose, onOpenSettings }: Props) {
  const { pages } = useNotes();
  const { pdfs } = usePdfs();
  const { apiKey, model } = useAiSettings();
  const [messages, setMessages] = usePersistentState<ChatMessage[]>("ai:chat", []);
  const [input, setInput] = useState("");
  const [includeSource, setIncludeSource] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const source = findSource(sectionId, selectedId, pages, pdfs);
  const attached = includeSource ? source : null; // was mit der nächsten Frage mitgeht

  const scrollToEnd = () =>
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setError(null);
    const userMessage: ChatMessage = {
      role: "user",
      text: question,
      attached: attached?.title,
    };
    const history = [...messages, userMessage];
    setMessages([...history, { role: "assistant", text: "" }]);
    setInput("");
    setBusy(true);
    scrollToEnd();

    const controller = new AbortController();
    abortRef.current = controller;
    let answer = "";
    let step = "Notiz/PDF vorbereiten"; // für die Fehlermeldung: wobei ist es schiefgegangen?
    try {
      const attachment = attached ? await loadAttachment(attached) : null;
      const ask = (modelName: string) =>
        askGemini({
          apiKey,
          model: modelName,
          history,
          attachment,
          signal: controller.signal,
          onText: (soFar) => {
            answer = soFar;
            setMessages([...history, { role: "assistant", text: soFar }]);
          },
        });
      try {
        step = `Anfrage an ${model}`;
        await ask(model);
      } catch (e) {
        // Modell gibt es nicht (mehr)? Dann selbst ein passendes aussuchen, merken und nochmal fragen.
        if (!isModelMissing(e)) throw e;
        step = "Modell-Liste abrufen";
        let candidates: string[];
        try {
          const best = pickModel(await listGeminiModels(apiKey));
          candidates = best ? [best] : FALLBACK_MODELS;
        } catch {
          candidates = FALLBACK_MODELS; // Liste nicht abrufbar: bekannte Namen durchprobieren
        }
        let lastError: unknown = e;
        for (const candidate of candidates.filter((c) => c !== model)) {
          step = `Anfrage an ${candidate}`;
          try {
            await ask(candidate);
            saveAiSettings({ apiKey, model: candidate });
            lastError = null;
            break;
          } catch (retryError) {
            lastError = retryError;
            if (!isModelMissing(retryError)) break;
          }
        }
        if (lastError) throw lastError;
      }
    } catch (e) {
      if (controller.signal.aborted) {
        if (!answer) setMessages(history); // gestoppt, bevor etwas kam: nur die Frage bleibt stehen
      } else {
        // Fehlgeschlagen: Frage zurück ins Eingabefeld, damit nichts verloren geht.
        setMessages(answer ? [...history, { role: "assistant", text: answer }] : messages);
        if (!answer) setInput(question);
        setError(`${describeAiError(e)} (Schritt: ${step})`);
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      scrollToEnd();
    }
  };

  const stop = () => abortRef.current?.abort();

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Antwort kopiert – mit ⌘V in eine Notiz einfügen.");
    } catch {
      showToast("Kopieren hat nicht geklappt.");
    }
  };

  const SourceIcon = source?.kind === "pdf" ? FileText : NotebookPen;

  return (
    <aside className="ai-sidebar">
      <header className="ai-header">
        <Sparkles size={16} />
        <span>KI-Assistent</span>
        <span className="ai-model">{model}</span>
        <button
          className="icon-button"
          title="Neuer Chat"
          onClick={() => {
            stop();
            setMessages([]);
            setError(null);
          }}
          disabled={!messages.length}
        >
          <Trash2 size={15} />
        </button>
        <button className="icon-button" title="KI-Leiste schließen" onClick={onClose}>
          <X size={16} />
        </button>
      </header>

      {!apiKey ? (
        <div className="ai-empty">
          <Sparkles size={28} strokeWidth={1.5} />
          <p>Um die KI zu nutzen, trag einmal deinen kostenlosen Gemini-Schlüssel ein.</p>
          <button className="primary-button" onClick={onOpenSettings}>
            Zu den KI-Einstellungen
          </button>
        </div>
      ) : (
        <>
          <div className="ai-messages" ref={listRef}>
            {messages.length === 0 && (
              <div className="ai-empty">
                <Sparkles size={28} strokeWidth={1.5} />
                <p>
                  Stell eine Frage – oder öffne eine Notiz bzw. ein PDF und nutze die Knöpfe unten.
                </p>
              </div>
            )}
            {messages.map((message, index) => (
              <div key={index} className={`ai-message ${message.role}`}>
                {message.role === "user" ? (
                  <>
                    {message.attached && (
                      <span className="ai-attached">mit „{message.attached}“</span>
                    )}
                    <p>{message.text}</p>
                  </>
                ) : message.text ? (
                  <>
                    <AiMarkdown text={message.text} />
                    {!(busy && index === messages.length - 1) && (
                      <button className="ai-copy" onClick={() => copy(message.text)} title="Antwort kopieren">
                        <Copy size={13} /> Kopieren
                      </button>
                    )}
                  </>
                ) : (
                  <span className="ai-typing">denkt nach …</span>
                )}
              </div>
            ))}
            {error && <p className="ai-error">{error}</p>}
          </div>

          <footer className="ai-footer">
            {source ? (
              <label className={`ai-source ${attached ? "on" : ""}`}>
                <input
                  type="checkbox"
                  checked={includeSource}
                  onChange={(e) => setIncludeSource(e.target.checked)}
                />
                <SourceIcon size={14} />
                <span>
                  {attached ? "Wird mitgeschickt: " : "Nicht mitschicken: "}„{source.title}“
                </span>
              </label>
            ) : (
              <p className="ai-source-hint">Öffne eine Notiz oder ein PDF, damit die KI sie kennt.</p>
            )}

            {attached && (
              <div className="ai-actions">
                {QUICK_ACTIONS.map((action) => (
                  <button key={action.label} onClick={() => send(action.prompt)} disabled={busy}>
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            <div className="ai-input">
              <textarea
                value={input}
                placeholder="Frag die KI …"
                rows={2}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              {busy ? (
                <button className="icon-button ai-send" onClick={stop} title="Stoppen">
                  <Square size={16} />
                </button>
              ) : (
                <button
                  className="icon-button ai-send"
                  onClick={() => send(input)}
                  disabled={!input.trim()}
                  title="Senden (Enter)"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </footer>
        </>
      )}
    </aside>
  );
}
