// Einstellungen → KI: Gemini-Schlüssel eintragen, testen und Modell wählen.
import { useState } from "react";
import { CheckCircle2, ExternalLink, KeyRound, ShieldCheck } from "lucide-react";

import { DEFAULT_MODEL, saveAiSettings, useAiSettings } from "./aiConfig";
import { describeAiError, listGeminiModels, pickModel } from "./gemini";

export function AiSettings() {
  const settings = useAiSettings();
  const [keyInput, setKeyInput] = useState(settings.apiKey);
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Schlüssel prüfen (Google fragen, welche Modelle es gibt) und bei Erfolg speichern.
  const testAndSave = async () => {
    const apiKey = keyInput.trim();
    if (!apiKey) return;
    setBusy(true);
    setStatus(null);
    try {
      const available = await listGeminiModels(apiKey);
      setModels(available);
      // Eingestelltes Modell gibt es nicht? Dann automatisch ein passendes wählen.
      const model = available.includes(settings.model)
        ? settings.model
        : (pickModel(available) ?? settings.model);
      saveAiSettings({ apiKey, model });
      setStatus({ kind: "ok", text: "Verbindung klappt – der Schlüssel ist gespeichert." });
    } catch (e) {
      setStatus({ kind: "error", text: describeAiError(e) });
    }
    setBusy(false);
  };

  const removeKey = () => {
    saveAiSettings({ ...settings, apiKey: "" });
    setKeyInput("");
    setModels([]);
    setStatus({ kind: "ok", text: "Schlüssel wurde von diesem Gerät entfernt." });
  };

  const modelOptions = models.length ? models : [...new Set([settings.model, DEFAULT_MODEL])];

  return (
    <div className="settings">
      <h1>KI</h1>
      <p className="settings-intro">
        Die KI-Leiste (rechts, Knopf <strong>„KI“</strong> unten links) nutzt Google Gemini. Dafür
        brauchst du einmalig einen <strong>kostenlosen Schlüssel</strong>.
      </p>

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
        {settings.apiKey && (
          <p className="ai-key-saved">
            <CheckCircle2 size={14} /> Ein Schlüssel ist gespeichert.{" "}
            <button className="link-button" onClick={removeKey}>
              Entfernen
            </button>
          </p>
        )}
      </section>

      {status && <p className={`settings-status ${status.kind}`}>{status.text}</p>}

      <section className="settings-card">
        <div>
          <h2>Modell</h2>
          <p>
            Beim Testen wird automatisch das neueste schnelle „Flash“-Modell gewählt (gratis
            nutzbar). Nach „Testen“ kannst du hier auch ein anderes auswählen.
          </p>
        </div>
        <select
          className="ai-model-select"
          value={settings.model}
          onChange={(e) => saveAiSettings({ ...settings, model: e.target.value })}
        >
          {modelOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </section>

      <div className="ai-privacy">
        <ShieldCheck size={18} />
        <div>
          <h2>Datenschutz</h2>
          <p>
            Der Schlüssel bleibt nur auf diesem Gerät (er steht auch nicht in Sicherungsdateien).
            An Google geht nur, was du in der KI-Leiste abschickst – deine Frage und, wenn angehakt,
            die gerade offene Notiz bzw. das PDF.
          </p>
          <p>
            Laut Googles Bedingungen werden Eingaben von Nutzern in der EU, der Schweiz und
            Großbritannien auch in der Gratis-Stufe <strong>nicht</strong> zum Verbessern der KI
            verwendet. Google kann das ändern – hier nachlesen:{" "}
            <a href="https://ai.google.dev/gemini/terms" target="_blank" rel="noreferrer">
              Gemini-API-Bedingungen <ExternalLink size={12} />
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
