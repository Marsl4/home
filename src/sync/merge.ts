// Zusammenführen, wenn derselbe Eintrag auf beiden Geräten geändert wurde.
// - Listen mit IDs (Seiten, ToDos, Striche, Bilder, Textfelder …): beide zusammen, nichts geht verloren.
//   Ist ein Objekt auf beiden Seiten vorhanden, gewinnt die neuere Seite. Gelöschtes bleibt gelöscht.
// - PDF-Zeichnungen: pro PDF-Seite wie eine Liste.
// - Alles andere (z. B. der getippte Text einer Seite): der neuere Stand gewinnt.
import { isIdListKey, type Tombstones } from "./tracker";

type WithId = { id: string };

function mergeLists(newer: unknown, older: unknown, deleted: Set<string>): unknown[] {
  const a = (Array.isArray(newer) ? newer : []) as WithId[];
  const b = (Array.isArray(older) ? older : []) as WithId[];
  const seen = new Set(a.map((item) => item.id));
  // Reihenfolge der neueren Seite, dann die Einträge, die nur die ältere Seite hat.
  return [...a, ...b.filter((item) => !seen.has(item.id))].filter((item) => !deleted.has(item.id));
}

export function mergeValues(
  key: string,
  local: unknown,
  remote: unknown,
  localIsNewer: boolean,
  tombstones: Tombstones,
): unknown {
  const deleted = new Set(tombstones.ids);
  const [newer, older] = localIsNewer ? [local, remote] : [remote, local];

  if (key === "sync-deleted") return mergeTombstones(local as Tombstones, remote as Tombstones);
  if (isIdListKey(key)) return mergeLists(newer, older, deleted);
  if (key.startsWith("pdf-ink:")) {
    const n = (newer ?? {}) as Record<string, unknown>;
    const o = (older ?? {}) as Record<string, unknown>;
    const pages = new Set([...Object.keys(n), ...Object.keys(o)]);
    return Object.fromEntries([...pages].map((page) => [page, mergeLists(n[page], o[page], deleted)]));
  }
  return newer;
}

export function mergeTombstones(a: Tombstones | undefined, b: Tombstones | undefined): Tombstones {
  return {
    ids: [...new Set([...(a?.ids ?? []), ...(b?.ids ?? [])])],
    keys: [...new Set([...(a?.keys ?? []), ...(b?.keys ?? [])])],
  };
}
