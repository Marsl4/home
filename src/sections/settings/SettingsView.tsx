// Einstellungen: "Daten & Backup", "Darstellung", "KI" und "Konto" (kommt später).
import { useEffect, useRef, useState } from "react";
import { Cloud, Download, HardDriveDownload } from "lucide-react";

import { AiSettings } from "../../ai/AiSettings";
import { SyncSettings } from "../../sync/SyncSettings";
import { downloadBackup, restoreBackup } from "../../storage/backup";
import { markAllDirty } from "../../sync/tracker";
import { useNotes } from "../notes/NotesContext";
import { usePdfs } from "../pdfs/PdfsContext";
import { useTodos } from "../todos/TodosContext";
import type { SectionProps } from "../types";
import { AppearanceSettings } from "./AppearanceSettings";

export function SettingsView(props: SectionProps) {
  if (props.selectedId === "account") return <SyncSettings />;
  if (props.selectedId === "appearance") return <AppearanceSettings />;
  if (props.selectedId === "ai") return <AiSettings />;
  return <BackupSettings />;
}

function BackupSettings() {
  const { pages, subjects } = useNotes();
  const { todos } = useTodos();
  const { pdfs } = usePdfs();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      await downloadBackup();
      setStatus({ kind: "ok", text: "Sicherung wurde heruntergeladen (Ordner „Downloads“)." });
    } catch (e) {
      setStatus({ kind: "error", text: `Sicherung fehlgeschlagen: ${String(e)}` });
    }
    setBusy(false);
  };

  const handleImport = async (file: File) => {
    const ok = window.confirm(
      "Achtung: Beim Wiederherstellen werden ALLE aktuellen Daten durch die Sicherung ersetzt. Fortfahren?",
    );
    if (!ok) return;
    setBusy(true);
    try {
      await restoreBackup(file);
      await markAllDirty(); // beim nächsten Sync gilt der wiederhergestellte Stand als neu
      window.location.reload(); // App neu laden, damit alle Bereiche die neuen Daten anzeigen
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof Error ? e.message : String(e) });
      setBusy(false);
    }
  };

  return (
    <div className="settings">
      <h1>Daten & Backup</h1>
      <p className="settings-intro">
        Deine Daten liegen nur in dieser App auf diesem Gerät. Erstelle regelmäßig eine Sicherung –
        am besten speicherst du sie in <strong>iCloud Drive</strong>, dann kannst du sie auch auf
        anderen Geräten wiederherstellen.
      </p>

      <div className="settings-stats">
        <Stat label="Notizseiten" value={pages.length} />
        <Stat label="Ordner" value={subjects.length} />
        <Stat label="ToDos" value={todos.length} />
        <Stat label="PDFs" value={pdfs.length} />
      </div>

      <StorageInfo />

      <section className="settings-card">
        <div>
          <h2>Sicherung erstellen</h2>
          <p>Speichert alles (inkl. Zeichnungen und PDFs) in eine Datei.</p>
        </div>
        <button className="primary-button" onClick={handleExport} disabled={busy}>
          <Download size={16} /> Sicherung herunterladen
        </button>
      </section>

      <section className="settings-card">
        <div>
          <h2>Sicherung wiederherstellen</h2>
          <p>Ersetzt alle aktuellen Daten durch die Daten aus einer Sicherungsdatei.</p>
        </div>
        <button className="secondary-button" onClick={() => fileRef.current?.click()} disabled={busy}>
          <HardDriveDownload size={16} /> Datei auswählen …
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) handleImport(file);
          }}
        />
      </section>

      {status && <p className={`settings-status ${status.kind}`}>{status.text}</p>}

      <p className="settings-hint">
        <Cloud size={14} /> Abgleich zwischen Mac und iPad: siehe „Konto & Sync“.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="settings-stat">
      <span className="settings-stat-value">{value}</span>
      <span className="settings-stat-label">{label}</span>
    </div>
  );
}

// Wie viel Platz die App auf dem Gerät belegt und ob die Daten vor automatischem Löschen geschützt sind.
function StorageInfo() {
  const [info, setInfo] = useState<{ usedMb: number; persisted: boolean } | null>(null);
  useEffect(() => {
    (async () => {
      const estimate = await navigator.storage?.estimate?.();
      const persisted = (await navigator.storage?.persisted?.()) ?? false;
      if (estimate) setInfo({ usedMb: (estimate.usage ?? 0) / 1024 / 1024, persisted });
    })().catch(() => {});
  }, []);
  if (!info) return null;
  return (
    <p className="settings-hint storage-info">
      Belegt auf diesem Gerät: <strong>{info.usedMb < 1 ? "< 1" : Math.round(info.usedMb)} MB</strong>
      {info.persisted ? " · vor automatischem Löschen geschützt" : ""}
    </p>
  );
}
