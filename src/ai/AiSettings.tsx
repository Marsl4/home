// Einstellungen → KI: Anbieter wählen (Groq oder Google Gemini), Schlüssel eintragen, testen und Modell wählen.
import { useState, type ReactNode } from "react";
import { CheckCircle2, ExternalLink, KeyRound, ShieldCheck } from "lucide-react";

import { DEFAULT_MODEL, saveAiSettings, useAiSettings, type AiSettings as Settings } from "./aiConfig";
import { listGeminiModels, pickModel } from "./gemini";
import { DEFAULT_GROQ_MODEL, listGroqModels, pickGroqModel } from "./groq";
import { activeProvider, describeAiError } from "./provider";

type Status = { kind: "ok" | "error"; text: string } | null;

export function AiSettings() {
  const settings = useAiSettings();
  const provider = activeProvider(settings);

  return (
    <div className="settings">
      <h1>KI</h1>
      <p className="settings-intro">
        Die KI-Leiste (Knopf <strong>„KI“</strong> unten links) und der Englisch-Bereich brauchen einen
        KI-Anbieter. Beide hier sind <strong>kostenlos</strong> – du brauchst nur einmalig einen Schlüssel.
      </p>

      <section className="settings-card">
        <div>
          <h2>Anbieter</h2>
          <p>
            <strong>Groq</strong> ist sehr schnell und hat großzügige Gratis-Grenzen (empfohlen).{" "}
            <strong>Gemini</strong> von Google kann zusätzlich eingescannte PDF-Seiten lesen, ist aber
            langsamer und hat im Gratis-Tarif nur wenige Anfragen pro Tag.
          </p>
        </div>
        <div className="segmented">
          <button
            className={provider === "groq" ? "selected" : ""}
            onClick={() => saveAiSettings({ ...settings, provider: "groq" })}
          >
            Groq
          </button>
          <button
            className={provider === "gemini" ? "selected" : ""}
            onClick={() => saveAiSettings({ ...settings, provider: "gemini" })}
          >
            Gemini
          </button>
        </div>
      </section>

      {provider === "groq" ? <GroqSetup settings={settings} /> : <GeminiSetup settings={settings} />}

      <section className="settings-card">
        <div>
          <h2>Antworten</h2>
          <p>
            „Schnell“: die KI denkt nur kurz nach und antwortet zügig – reicht meist. „Gründlich“: mehr
            Nachdenken, z. B. für schwierige Aufgaben, dafür längere Wartezeit.
          </p>
        </div>
        <div className="segmented">
          <button
            className={!settings.thorough ? "selected" : ""}
            onClick={() => saveAiSettings({ ...settings, thorough: false })}
          >
            Schnell
          </button>
          <button
            className={settings.thorough ? "selected" : ""}
            onClick={() => saveAiSettings({ ...settings, thorough: true })}
          >
            Gründlich
          </button>
        </div>
      </section>

      <div className="ai-privacy">
        <ShieldCheck size={18} />
        <div>
          <h2>Datenschutz</h2>
          <p>
            Die Schlüssel bleiben nur auf diesem Gerät (sie stehen auch nicht in Sicherungsdateien).
            An den Anbieter geht nur, was du abschickst – deine Frage und, wenn angehakt, die gerade offene
            Notiz bzw. das PDF. Im Englisch-Bereich: dein Lernziel, deine Testantworten und die Schreibprobe.
          </p>
          {provider === "groq" ? (
            <p>
              Was Groq mit den Daten macht, steht hier:{" "}
              <a href="https://groq.com/privacy-policy" target="_blank" rel="noreferrer">
                Groq-Datenschutz <ExternalLink size={12} />
              </a>
            </p>
          ) : (
            <p>
              Laut Googles Bedingungen werden Eingaben von Nutzern in der EU, der Schweiz und
              Großbritannien auch in der Gratis-Stufe <strong>nicht</strong> zum Verbessern der KI
              verwendet. Google kann das ändern – hier nachlesen:{" "}
              <a href="https://ai.google.dev/gemini/terms" target="_blank" rel="noreferrer">
                Gemini-API-Bedingungen <ExternalLink size={12} />
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Groq ----------
function GroqSetup({ settings }: { settings: Settings }) {
  const [models, setModels] = useState<string[]>([]);
  const model = settings.groqModel ?? DEFAULT_GROQ_MODEL;

  return (
    <>
      <ol className="ai-steps">
        <li>
          Öffne{" "}
          <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
            console.groq.com/keys <ExternalLink size={12} />
          </a>{" "}
          und melde dich an (z. B. mit deinem Google-Konto) – kostenlos, ohne Kreditkarte.
        </li>
        <li>
          Klicke auf <strong>„Create API Key“</strong>, gib einen beliebigen Namen ein (z. B. „Home“) und
          kopiere den Schlüssel.
        </li>
        <li>Füge ihn unten ein und klicke auf „Testen & speichern“.</li>
      </ol>

      <KeyCard
        savedKey={settings.groqKey ?? ""}
        onTest={async (groqKey) => {
          const available = await listGroqModels(groqKey);
          setModels(available);
          const groqModel = available.includes(model) ? model : (pickGroqModel(available) ?? model);
          saveAiSettings({ ...settings, groqKey, groqModel });
        }}
        onRemove={() => {
          saveAiSettings({ ...settings, groqKey: "" });
          setModels([]);
        }}
      />

      <ModelCard
        text={
          <>
            Empfohlen: <strong>{DEFAULT_GROQ_MODEL}</strong> (gut und schnell). Nach „Testen“ kannst du hier
            auch ein anderes wählen – jedes Modell hat eigene Gratis-Grenzen.
          </>
        }
        model={model}
        options={models.length ? models : [...new Set([model, DEFAULT_GROQ_MODEL])]}
        onChange={(groqModel) => saveAiSettings({ ...settings, groqModel })}
      />

      <p className="muted">
        Eingescannte PDF-Seiten (Bilder ohne Text) kann Groq nicht lesen. Ist zusätzlich ein Gemini-Schlüssel
        eingetragen (bei „Gemini“ oben), nimmt die App dafür automatisch Gemini.
        {settings.apiKey ? " – Ein Gemini-Schlüssel ist eingetragen." : ""}
      </p>
    </>
  );
}

// ---------- Google Gemini ----------
function GeminiSetup({ settings }: { settings: Settings }) {
  const [models, setModels] = useState<string[]>([]);

  return (
    <>
      <ol className="ai-steps">
        <li>
          Öffne{" "}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            aistudio.google.com/apikey <ExternalLink size={12} />
          </a>{" "}
          und melde dich mit deinem Google-Konto an.
        </li>
        <li>
          Klicke auf <strong>„Create API key“</strong> und kopiere den Schlüssel.
        </li>
        <li>Füge ihn unten ein und klicke auf „Testen & speichern“.</li>
      </ol>

      <KeyCard
        savedKey={settings.apiKey}
        onTest={async (apiKey) => {
          const available = await listGeminiModels(apiKey);
          setModels(available);
          // Eingestelltes Modell gibt es nicht? Dann automatisch ein passendes wählen.
          const model = available.includes(settings.model) ? settings.model : (pickModel(available) ?? settings.model);
          saveAiSettings({ ...settings, apiKey, model });
        }}
        onRemove={() => {
          saveAiSettings({ ...settings, apiKey: "" });
          setModels([]);
        }}
      />

      <ModelCard
        text="Beim Testen wird automatisch das neueste schnelle „Flash“-Modell gewählt. Nach „Testen“ kannst du hier auch ein anderes auswählen – jedes Modell hat eigene Gratis-Grenzen."
        model={settings.model}
        options={models.length ? models : [...new Set([settings.model, DEFAULT_MODEL])]}
        onChange={(model) => saveAiSettings({ ...settings, model })}
      />
    </>
  );
}

// ---------- Bausteine ----------
// Schlüssel eingeben → onTest prüft ihn beim Anbieter und speichert ihn bei Erfolg.
function KeyCard(props: { savedKey: string; onTest: (key: string) => Promise<void>; onRemove: () => void }) {
  const [keyInput, setKeyInput] = useState(props.savedKey);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  const testAndSave = async () => {
    const key = keyInput.trim();
    if (!key) return;
    setBusy(true);
    setStatus(null);
    try {
      await props.onTest(key);
      setStatus({ kind: "ok", text: "Verbindung klappt – der Schlüssel ist gespeichert." });
    } catch (e) {
      setStatus({ kind: "error", text: describeAiError(e, { withAttachment: false }) });
    }
    setBusy(false);
  };

  return (
    <>
      <section className="settings-card ai-key-card">
        <div className="ai-key-row">
          <KeyRound size={16} />
          <input
            type="password"
            className="ai-key-input"
            placeholder="API-Schlüssel hier einfügen"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && testAndSave()}
            autoComplete="off"
            spellCheck={false}
          />
          <button className="primary-button" onClick={testAndSave} disabled={busy || !keyInput.trim()}>
            {busy ? "Teste …" : "Testen & speichern"}
          </button>
        </div>
        {props.savedKey && (
          <p className="ai-key-saved">
            <CheckCircle2 size={14} /> Ein Schlüssel ist gespeichert.{" "}
            <button
              className="link-button"
              onClick={() => {
                props.onRemove();
                setKeyInput("");
                setStatus({ kind: "ok", text: "Schlüssel wurde von diesem Gerät entfernt." });
              }}
            >
              Entfernen
            </button>
          </p>
        )}
      </section>
      {status && <p className={`settings-status ${status.kind}`}>{status.text}</p>}
    </>
  );
}

function ModelCard(props: { text: ReactNode; model: string; options: string[]; onChange: (model: string) => void }) {
  return (
    <section className="settings-card">
      <div>
        <h2>Modell</h2>
        <p>{props.text}</p>
      </div>
      <select className="ai-model-select" value={props.model} onChange={(e) => props.onChange(e.target.value)}>
        {props.options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </section>
  );
}
