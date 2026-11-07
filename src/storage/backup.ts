// Sicherung: ALLE Daten der App (Seiten, Zeichnungen, Fächer, ToDos, PDFs) in eine Datei
// schreiben bzw. aus einer solchen Datei wiederherstellen.
// Die Datei ist JSON (Text). PDF-Dateien werden dafür in Text umgewandelt (Base64).
import { clear, entries, setMany } from "idb-keyval";

const APP_ID = "studium-app";
const FORMAT_VERSION = 1;

type BackupFile = {
  app: typeof APP_ID;
  version: number;
  exportedAt: string;
  entries: [string, unknown][];
};

// Markierung für Dateien (Blobs), die als Text gespeichert wurden.
type EncodedBlob = { __blob: string; type: string };

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function encode(value: unknown): Promise<unknown> {
  return value instanceof Blob ? { __blob: await blobToDataUrl(value), type: value.type } : value;
}

async function decode(value: unknown): Promise<unknown> {
  if (value && typeof value === "object" && "__blob" in value) {
    const { __blob, type } = value as EncodedBlob;
    const blob = await (await fetch(__blob)).blob();
    return new Blob([blob], { type });
  }
  return value;
}

// Erstellt die Sicherungsdatei und lädt sie herunter.
export async function downloadBackup(): Promise<void> {
  await downloadEntries(await entries<string, unknown>(), "backup");
}

// Beliebige Einträge (z. B. die Sicherheitskopie vor dem ersten Sync) als Sicherungsdatei herunterladen.
export async function downloadEntries(all: [string, unknown][], label: string): Promise<void> {
  const backup: BackupFile = {
    app: APP_ID,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    entries: await Promise.all(all.map(async ([key, value]) => [key, await encode(value)] as [string, unknown])),
  };

  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const date = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `studium-${label}-${date}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Liest eine Sicherungsdatei und ERSETZT damit alle aktuellen Daten.
export async function restoreBackup(file: File): Promise<void> {
  let backup: BackupFile;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    throw new Error("Die Datei ist keine gültige Sicherung.");
  }
  if (backup.app !== APP_ID || !Array.isArray(backup.entries)) {
    throw new Error("Die Datei ist keine Sicherung dieser App.");
  }
  if (backup.version > FORMAT_VERSION) {
    throw new Error("Die Sicherung stammt aus einer neueren Version der App.");
  }

  // Erst alles entschlüsseln, DANN löschen + schreiben – so bleibt bei einem Fehler nichts halb kaputt.
  const decoded = await Promise.all(
    backup.entries.map(async ([key, value]) => [key, await decode(value)] as [string, unknown]),
  );
  await clear();
  await setMany(decoded);
}
