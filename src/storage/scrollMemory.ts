// Merkt sich pro Notiz/PDF, wo man zuletzt war (Scroll-Stelle). Nur Ansichts-Einstellung im Browser,
// keine echten Daten – darum localStorage und nicht db.ts.
import { readStored } from "./uiState";

const KEY = "ui:scrollPositions";
const MAX_ENTRIES = 300; // damit die Liste nicht endlos wächst

// PDFs: Seite (ab 0) + wie weit man in dieser Seite ist (0…1) – passt auch, wenn das Fenster anders breit ist.
// Notizen: Pixel von oben.
export type ScrollSpot = { page: number; within: number } | { top: number };

type Stored = Record<string, ScrollSpot & { at: number }>;

export function readScrollSpot(id: string): ScrollSpot | null {
  return readStored<Stored>(KEY, {})[id] ?? null;
}

export function saveScrollSpot(id: string, spot: ScrollSpot) {
  const all = readStored<Stored>(KEY, {});
  all[id] = { ...spot, at: Date.now() };
  const ids = Object.keys(all);
  if (ids.length > MAX_ENTRIES) {
    ids.sort((a, b) => all[a].at - all[b].at);
    for (const old of ids.slice(0, ids.length - MAX_ENTRIES)) delete all[old];
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Nicht schlimm, dann wird es nur nicht gemerkt.
  }
}

// Setzt die Scroll-Stelle, sobald der Inhalt hoch genug ist (Notizen bauen sich erst nach und nach auf).
// Hört auf, sobald es geklappt hat, nach ~2 Sekunden oder wenn man selbst scrollt.
// running(): läuft das Zurückspringen noch? (Solange nichts speichern, sonst würde eine Zwischenstelle gemerkt.)
export function restoreScrollTop(scroller: HTMLElement, getTarget: () => number | null) {
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  scroller.addEventListener("wheel", stop, { passive: true, once: true });
  scroller.addEventListener("touchstart", stop, { passive: true, once: true });
  const started = Date.now();
  const step = () => {
    if (stopped) return;
    const target = getTarget();
    if (target !== null) {
      scroller.scrollTop = target;
      if (Math.abs(scroller.scrollTop - target) < 2) return stop();
    }
    if (Date.now() - started < 2000) requestAnimationFrame(step);
  };
  step();
  return {
    running: () => !stopped && Date.now() - started < 2000,
    cancel: () => {
      stop();
      scroller.removeEventListener("wheel", stop);
      scroller.removeEventListener("touchstart", stop);
    },
  };
}
