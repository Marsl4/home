// Einstellungen → GitHub: Lese-Schlüssel eintragen, damit Hausarbeiten und Präsentationen
// aus VS Code (GitHub) in der App erscheinen.
import { useState } from "react";
import { CheckCircle2, ExternalLink, KeyRound, ShieldCheck } from "lucide-react";

import { checkToken, describeGithubError, saveGithubSettings, useGithubSettings } from "./github";
import { forgetProjects, refreshProjects } from "./projectStore";

export function GithubSettings() {
  const settings = useGithubSettings();
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const testAndSave = async () => {
    const token = input.trim();
    if (!token) return;
    setBusy(true);
    setStatus(null);
    try {
      const login = await checkToken(token);
      if (login !== settings.login) await forgetProjects(); // anderes Konto: alte Liste vergessen
      saveGithubSettings({ token, login });
      setInput("");
      setStatus({ kind: "ok", text: `Verbunden als „${login}“ – der Schlüssel ist gespeichert.` });
      refreshProjects(true);
    } catch (e) {
      setStatus({ kind: "error", text: describeGithubError(e) });
    }
    setBusy(false);
  };

  return (
    <div className="settings">
      <h1>GitHub</h1>
      <p className="settings-intro">
        Hausarbeiten und Präsentationen, die du in VS Code mit Claude erstellst, liegen als private Projekte auf
        GitHub. Mit einem <strong>Lese-Schlüssel</strong> zeigt die App sie unter Uni → Hausarbeiten / Präsentationen
        an – immer im neuesten Stand, auch auf dem iPad.
      </p>

      <ol className="ai-steps">
        <li>
          Öffne{" "}
          <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
            github.com/settings/personal-access-tokens/new <ExternalLink size={12} />
          </a>{" "}
          (Fine-grained token) und melde dich an.
        </li>
        <li>
          Name: z. B. „Home-App“. Ablauf („Expiration“): z. B. 1 Jahr.
        </li>
        <li>
          Bei <strong>„Repository access“</strong>: „All repositories“ (dann erscheinen neue Projekte automatisch).
        </li>
        <li>
          Bei <strong>„Permissions“ → „Repository permissions“</strong>: <strong>Contents</strong> auf „Read-only“
          stellen. Sonst nichts – die App kann damit nur lesen, nichts ändern.
        </li>
        <li>
          Unten auf <strong>„Generate token“</strong> klicken, den Schlüssel kopieren, hier einfügen und „Testen &
          speichern“ klicken.
        </li>
      </ol>

      <section className="settings-card ai-key-card">
        <div className="ai-key-row">
          <KeyRound size={16} />
          <input
            type="password"
            className="ai-key-input"
            placeholder={settings.token ? "Neuen Schlüssel einfügen (ersetzt den alten)" : "github_pat_… hier einfügen"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && testAndSave()}
            autoComplete="off"
            spellCheck={false}
          />
          <button className="primary-button" onClick={testAndSave} disabled={busy || !input.trim()}>
            {busy ? "Teste …" : "Testen & speichern"}
          </button>
        </div>
        {settings.token && (
          <p className="ai-key-saved">
            <CheckCircle2 size={14} /> Verbunden als „{settings.login}“.{" "}
            <button
              className="link-button"
              onClick={async () => {
                saveGithubSettings({ token: "", login: "" });
                await forgetProjects();
                setStatus({ kind: "ok", text: "Schlüssel wurde von diesem Gerät entfernt." });
              }}
            >
              Entfernen
            </button>
          </p>
        )}
      </section>

      {status && <p className={`settings-status ${status.kind}`}>{status.text}</p>}

      <div className="ai-privacy">
        <ShieldCheck size={18} />
        <div>
          <h2>Datenschutz</h2>
          <p>
            Der Schlüssel bleibt nur auf diesem Gerät (er steht auch nicht in Sicherungsdateien und wird nicht
            synchronisiert – auf dem iPad also einmal extra eintragen). Die App liest damit deine Projekte direkt bei
            GitHub; sie kann dort nichts ändern oder löschen.
          </p>
        </div>
      </div>
    </div>
  );
}
