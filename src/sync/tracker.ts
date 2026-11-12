// Merkt sich für den Sync, welche gespeicherten Einträge sich seit dem letzten Abgleich geändert haben.
// Alle Schreibzugriffe in db.ts laufen über trackedSet/trackedDel.
//
// Zusätzlich werden gelöschte Dinge vermerkt ("Grabsteine"): gelöschte Einträge (Schlüssel) und
// gelöschte Objekte in Listen (IDs, z. B. eine gelöschte Seite oder ein wegradierter Strich).
// Sonst würde beim Zusammenführen mit dem anderen Gerät Gelöschtes wieder auftauchen.
import { createStore, del, entries, get, keys, set, type UseStore } from "idb-keyval";

// Pro Eintrag: wann zuletzt geändert, ob noch hochzuladen, welchen Stand der Cloud wir zuletzt kannten.
export type SyncMeta = {
  modifiedAt: number;
  dirty: boolean;
  remoteSeen?: string; // "modifiedAt" der Cloud-Datei beim letzten Abgleich
};

export type Tombstones = { ids: string[]; keys: string[] };

export const TOMBSTONES_KEY = "sync-deleted";

// Eigene kleine Datenbank nur für diese Verwaltungsdaten (gehört nicht zu den App-Daten).
const metaStore: UseStore = createStore("home-sync", "meta");

const listeners = new Set<() => void>();
export function onLocalChange(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const notify = () => listeners.forEach((listener) => listener());

// Listen, deren Einträge eine "id" haben: hier werden Löschungen einzelner Einträge vermerkt.
// (Der Seiteninhalt des Editors gehört nicht dazu – er wird immer als Ganzes abgeglichen.)
export function isIdListKey(key: string): boolean {
  return (
    ["pages", "subjects", "todos", "pdfs", "english-vocab", "english-profiles"].includes(key) ||
    key.startsWith("english-vocab:") ||
    key.startsWith("page-drawing:") ||
    key.startsWith("page-images:") ||
    key.startsWith("page-texts:")
  );
}

function idsOf(key: string, value: unknown): Set<string> {
  const ids = new Set<string>();
  const collect = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const item of list) if (item && typeof item === "object" && "id" in item) ids.add(String(item.id));
  };
  if (isIdListKey(key)) collect(value);
  else if (key.startsWith("pdf-ink:") && value && typeof value === "object") Object.values(value).forEach(collect);
  return ids;
}

export async function markDirty(key: string) {
  const meta = (await get<SyncMeta>(key, metaStore)) ?? { modifiedAt: 0, dirty: true };
  await set(key, { ...meta, modifiedAt: Date.now(), dirty: true }, metaStore);
  notify();
}

async function addTombstones(ids: string[], deletedKeys: string[]) {
  if (ids.length === 0 && deletedKeys.length === 0) return;
  const current = (await get<Tombstones>(TOMBSTONES_KEY)) ?? { ids: [], keys: [] };
  await set(TOMBSTONES_KEY, {
    ids: [...new Set([...current.ids, ...ids])],
    keys: [...new Set([...current.keys, ...deletedKeys])],
  });
  await markDirty(TOMBSTONES_KEY);
}

// Speichern + für den Sync vermerken (inkl. Löschungen innerhalb von Listen).
export async function trackedSet(key: string, value: unknown) {
  const watchIds = isIdListKey(key) || key.startsWith("pdf-ink:");
  const before = watchIds ? idsOf(key, await get(key)) : null;
  await set(key, value);
  if (before) {
    const after = idsOf(key, value);
    await addTombstones([...before].filter((id) => !after.has(id)), []);
  }
  await markDirty(key);
}

// Löschen + für den Sync vermerken.
export async function trackedDel(key: string) {
  await del(key);
  await del(key, metaStore);
  await addTombstones([], [key]);
}

export function getMeta(key: string) {
  return get<SyncMeta>(key, metaStore);
}

export function setMeta(key: string, meta: SyncMeta) {
  return set(key, meta, metaStore);
}

export async function deleteMeta(key: string) {
  await del(key, metaStore);
}

export async function allMeta(): Promise<Map<string, SyncMeta>> {
  return new Map(await entries<string, SyncMeta>(metaStore));
}

// Nach dem Wiederherstellen einer Sicherung: alles gilt als geändert.
export async function markAllDirty() {
  for (const key of await keys<string>()) await markDirty(key);
}
