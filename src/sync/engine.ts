// Der eigentliche Abgleich mit Google Drive.
//
// Ablauf eines Abgleichs:
//  1. Liste aller Dateien in der Cloud holen.
//  2. Für jeden Eintrag vergleichen:
//     - in der Cloud geändert, hier nicht      -> herunterladen
//     - hier geändert, in der Cloud nicht       -> hochladen
//     - auf beiden Seiten geändert              -> zusammenführen (merge.ts), Ergebnis hoch + hier speichern
//     - gelöscht (Grabstein)                    -> auf beiden Seiten entfernen
//  3. Heruntergeladenes sofort in offenen Ansichten anzeigen (über den Live-Abgleich).
//
// Solange verbunden: nach jeder Änderung (kurz verzögert) und alle 15 Sekunden.
import { del, entries, get, keys, set, createStore } from "idb-keyval";

import { publish } from "../storage/liveSync";
import { readStored } from "../storage/uiState";
import { clientId } from "./config";
import { deleteFile, downloadFile, DriveAuthError, listFiles, uploadFile, type RemoteFile } from "./drive";
import { forgetToken, requestToken, storedToken } from "./googleAuth";
import { mergeTombstones, mergeValues } from "./merge";
import {
  allMeta,
  deleteMeta,
  getMeta,
  onLocalChange,
  setMeta,
  TOMBSTONES_KEY,
  type SyncMeta,
  type Tombstones,
} from "./tracker";

export type SyncStatus =
  | { state: "off" } // nie verbunden / getrennt
  | { state: "needs-auth" } // Stunde abgelaufen: einmal tippen
  | { state: "syncing"; lastSyncedAt: number | null }
  | { state: "ok"; lastSyncedAt: number }
  | { state: "error"; message: string; lastSyncedAt: number | null };

const ENABLED_KEY = "sync:enabled";
const LAST_KEY = "sync:lastSyncedAt";
const SOURCE_ID = "sync-engine"; // als "Absender" im Live-Abgleich
const POLL_MS = 15_000;
const CHANGE_DELAY_MS = 2_000;

let status: SyncStatus = { state: "off" };
const statusListeners = new Set<(status: SyncStatus) => void>();
let running: Promise<void> | null = null;
let again = false;
let pollTimer = 0;
let changeTimer = 0;

function setStatus(next: SyncStatus) {
  status = next;
  statusListeners.forEach((listener) => listener(next));
}

export function getStatus() {
  return status;
}

export function subscribeStatus(listener: (status: SyncStatus) => void) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

const isEnabled = () => readStored(ENABLED_KEY, false);
const lastSyncedAt = () => readStored<number | null>(LAST_KEY, null);
const save = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // egal
  }
};

// Beim App-Start: War Sync schon eingerichtet? Dann mit dem gespeicherten Zugang weitermachen
// oder (Stunde abgelaufen) um ein Tippen bitten.
export function initSync() {
  if (!clientId() || !isEnabled()) return;
  if (storedToken()) {
    startLoop();
  } else {
    setStatus({ state: "needs-auth" });
  }
}

// Klick auf "Sync" (muss direkt aus dem Klick kommen, wegen des Google-Fensters).
export async function connect() {
  const firstTime = !isEnabled();
  try {
    await requestToken(firstTime);
  } catch (error) {
    setStatus({ state: "error", message: String(error instanceof Error ? error.message : error), lastSyncedAt: lastSyncedAt() });
    return;
  }
  if (firstTime) await saveSafetyCopy();
  save(ENABLED_KEY, true);
  startLoop();
}

export function disconnect() {
  save(ENABLED_KEY, false);
  forgetToken();
  stopLoop();
  setStatus({ state: "off" });
}

let unsubscribeChanges: (() => void) | null = null;
function startLoop() {
  stopLoop();
  unsubscribeChanges = onLocalChange(() => {
    clearTimeout(changeTimer);
    changeTimer = window.setTimeout(syncNow, CHANGE_DELAY_MS);
  });
  pollTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") syncNow();
  }, POLL_MS);
  syncNow();
}

function stopLoop() {
  clearInterval(pollTimer);
  clearTimeout(changeTimer);
  unsubscribeChanges?.();
  unsubscribeChanges = null;
}

// Abgleich starten (läuft schon einer, wird danach direkt noch einer gemacht).
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await runOnce();
    } while (again);
  })().finally(() => (running = null));
  return running;
}

async function runOnce() {
  const token = storedToken();
  if (!token) {
    stopLoop();
    setStatus({ state: "needs-auth" });
    return;
  }
  setStatus({ state: "syncing", lastSyncedAt: lastSyncedAt() });
  try {
    await syncAll(token);
    const now = Date.now();
    save(LAST_KEY, now);
    setStatus({ state: "ok", lastSyncedAt: now });
  } catch (error) {
    if (error instanceof DriveAuthError) {
      forgetToken();
      stopLoop();
      setStatus({ state: "needs-auth" });
    } else if (!navigator.onLine) {
      setStatus({ state: "error", message: "Offline – wird nachgeholt, sobald Internet da ist.", lastSyncedAt: lastSyncedAt() });
    } else {
      console.error(error);
      setStatus({ state: "error", message: String(error instanceof Error ? error.message : error), lastSyncedAt: lastSyncedAt() });
    }
  }
}

const isBlobKey = (key: string) => key.startsWith("pdf-file:");

// Reihenfolge: zuerst Grabsteine, dann PDF-Dateien, dann Inhalte, zum Schluss die Listen
// (damit z. B. eine neue Seite erst erscheint, wenn ihr Inhalt schon da ist).
function order(key: string) {
  if (key === TOMBSTONES_KEY) return 0;
  if (isBlobKey(key)) return 1;
  if (["pages", "subjects", "todos", "pdfs"].includes(key)) return 3;
  return 2;
}

async function syncAll(token: string) {
  const remote = await listFiles(token);
  const metas = await allMeta();
  const localKeys = new Set(await keys<string>());
  const allKeys = [...new Set([...remote.keys(), ...localKeys, ...metas.keys()])].sort((a, b) => order(a) - order(b));

  let tombstones: Tombstones = (await get<Tombstones>(TOMBSTONES_KEY)) ?? { ids: [], keys: [] };

  for (const key of allKeys) {
    const file = remote.get(key);
    const meta = metas.get(key);

    // Gelöschte Einträge: überall entfernen.
    if (key !== TOMBSTONES_KEY && tombstones.keys.includes(key)) {
      if (file) await deleteFile(token, file);
      if (localKeys.has(key)) await del(key); // die zugehörige Seite/PDF ist ohnehin gelöscht
      await deleteMeta(key);
      continue;
    }

    const result = await syncKey(token, key, file, meta, localKeys.has(key), tombstones);
    if (key === TOMBSTONES_KEY && result !== undefined) tombstones = result as Tombstones;
  }
}

// Gleicht einen einzelnen Eintrag ab. Gibt den neuen Stand zurück (falls sich hier etwas geändert hat).
async function syncKey(
  token: string,
  key: string,
  file: RemoteFile | undefined,
  meta: SyncMeta | undefined,
  existsLocally: boolean,
  tombstones: Tombstones,
): Promise<unknown> {
  // Noch nie abgeglichen = alles hier Vorhandene gilt als "geändert".
  const localDirty = existsLocally && (meta?.dirty ?? true);
  const remoteChanged = !!file && file.modifiedAt !== meta?.remoteSeen;

  // PDF-Dateien ändern sich nie: einmal hoch bzw. einmal herunter.
  if (isBlobKey(key)) {
    if (file && !existsLocally) {
      const blob = await downloadFile(token, file, true);
      await set(key, blob);
      await setMeta(key, { modifiedAt: Number(file.modifiedAt), dirty: false, remoteSeen: file.modifiedAt });
      publish(key, SOURCE_ID, blob);
      return blob;
    }
    if (!file && existsLocally) await upload(token, key, file);
    else if (file && meta?.remoteSeen !== file.modifiedAt) {
      await setMeta(key, { modifiedAt: meta?.modifiedAt ?? 0, dirty: false, remoteSeen: file.modifiedAt });
    }
    return undefined;
  }

  if (remoteChanged && file) {
    const remoteValue = await downloadFile(token, file, false);
    if (localDirty) {
      // Auf beiden Seiten geändert: zusammenführen.
      const localValue = await get(key);
      const localIsNewer = (meta?.modifiedAt ?? 0) >= Number(file.modifiedAt);
      const merged =
        key === TOMBSTONES_KEY
          ? mergeTombstones(localValue as Tombstones, remoteValue as Tombstones)
          : mergeValues(key, localValue, remoteValue, localIsNewer, tombstones);
      await set(key, merged);
      publish(key, SOURCE_ID, merged);
      await upload(token, key, file, merged);
      return merged;
    }
    await set(key, remoteValue);
    await setMeta(key, { modifiedAt: Number(file.modifiedAt), dirty: false, remoteSeen: file.modifiedAt });
    publish(key, SOURCE_ID, remoteValue);
    return remoteValue;
  }

  if (localDirty) await upload(token, key, file);
  return undefined;
}

// Aktuellen Stand hochladen. Ändert sich der Eintrag währenddessen, bleibt er "geändert" (nächste Runde).
async function upload(token: string, key: string, file: RemoteFile | undefined, value?: unknown) {
  const before = await getMeta(key);
  const content = value ?? (await get(key));
  if (content === undefined) return;
  const modifiedAt = String(Date.now());
  const uploaded = await uploadFile(token, key, content, modifiedAt, file);
  const after = await getMeta(key);
  const changedMeanwhile = after && before && after.modifiedAt !== before.modifiedAt;
  await setMeta(key, {
    modifiedAt: changedMeanwhile ? after.modifiedAt : Number(modifiedAt),
    dirty: !!changedMeanwhile,
    remoteSeen: uploaded.modifiedAt,
  });
}

// ---------- Sicherheitskopie vor dem allerersten Abgleich ----------
const safetyStore = createStore("home-safety", "copies");

async function saveSafetyCopy() {
  const all = await entries();
  await set("before-first-sync", { savedAt: Date.now(), entries: all }, safetyStore);
}

export async function loadSafetyCopy(): Promise<{ savedAt: number; entries: [IDBValidKey, unknown][] } | undefined> {
  return get("before-first-sync", safetyStore);
}
