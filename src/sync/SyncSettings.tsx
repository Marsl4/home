// Einstellungen → Konto & Sync: Google Drive verbinden, Zustand sehen, trennen.
import { useState } from "react";
import { Cloud, Download, ExternalLink, ShieldCheck } from "lucide-react";

import { downloadEntries } from "../storage/backup";
import { clientId, GOOGLE_CLIENT_ID } from "./config";
import { connect, disconnect, loadSafetyCopy, syncNow } from "./engine";
import { preloadGoogle } from "./googleAuth";
import { describeStatus, useSyncStatus } from "./useSyncStatus";

export function SyncSettings() {
  const status = useSyncStatus();
  const [idInput, setIdInput] = useState(clientId());
  const configured = !!clientId();

  const saveClientId = () => {
    try {
      localStorage.setItem("sync:clientId", idInput.trim());
    } catch {
      // egal
    }
    preloadGoogle();
    window.location.reload();
  };

  const downloadSafetyCopy = async () => {
    const copy = await loadSafetyCopy();
    if (copy) await downloadEntries(copy.entries as [string, unknown][], "vor-erstem-sync");
  };

  return (
    <div className="settings">
      <h1>Konto & Sync</h1>
      <p className="settings-intro">
        Mit Sync sind deine Notizen, Zeichnungen, ToDos und PDFs auf <strong>Mac und iPad</strong> gleich.
        Gespeichert wird in einem <strong>versteckten App-Ordner deines Google Drive</strong> – die App
        sieht dort nur ihre eigenen Daten, nicht deine anderen Dateien.
      </p>

      {configured ? (
        <section className="settings-card">
          <div>
            <h2>
              <Cloud size={16} /> Google Drive
            </h2>
            <p>{describeStatus(status)}</p>
          </div>
          {status.state === "off" ? (
            <button className="primary-button" onClick={() => connect()}>
              Mit Google verbinden
            </button>
          ) : status.state === "needs-auth" || status.state === "error" ? (
            <button className="primary-button" onClick={() => connect()}>
              Neu verbinden
            </button>
          ) : (
            <button className="secondary-button" onClick={() => syncNow()}>
              Jetzt abgleichen
            </button>
          )}
        </section>
      ) : (
        <section className="settings-card ai-key-card">
          <div>
            <h2>Einrichtung</h2>
            <p>
              Trag hier die „Client-ID“ ein, die du bei Google erstellt hast (Anleitung bekommst du von
              Claude). Danach erscheint der Knopf zum Verbinden.
            </p>
          </div>
          <div className="ai-key-row">
            <input
              className="ai-key-input"
              placeholder="….apps.googleusercontent.com"
              value={idInput}
              onChange={(e) => setIdInput(e.target.value)}
              spellCheck={false}
            />
            <button className="primary-button" onClick={saveClientId} disabled={!idInput.trim().endsWith(".apps.googleusercontent.com")}>
              Speichern
            </button>
          </div>
        </section>
      )}

      <div className="ai-privacy">
        <ShieldCheck size={18} />
        <div>
          <h2>Gut zu wissen</h2>
          <p>
            Google erlaubt Web-Apps nur eine Stunde Zugang am Stück. Danach wird der Sync-Knopf links
            <strong> orange</strong> – einmal tippen, und es geht weiter. Was du in der Zwischenzeit
            änderst, bleibt auf dem Gerät und wird beim nächsten Verbinden nachgeholt.
          </p>
          <p>
            Vor dem allerersten Abgleich legt die App auf diesem Gerät eine Sicherheitskopie an.{" "}
            <button className="link-button" onClick={downloadSafetyCopy}>
              <Download size={12} /> Sicherheitskopie herunterladen
            </button>
          </p>
          {status.state !== "off" && (
            <p>
              <button className="link-button" onClick={disconnect}>
                Sync auf diesem Gerät ausschalten
              </button>{" "}
              (deine Daten bleiben auf dem Gerät und in Google Drive erhalten)
            </p>
          )}
          {!GOOGLE_CLIENT_ID && configured && (
            <p>
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
                Google Cloud Console <ExternalLink size={12} />
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
