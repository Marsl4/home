// Merkt sich kleine Ansichts-Einstellungen (welcher Bereich offen war usw.) im Browser.
// Nicht für echte Daten gedacht – die liegen in db.ts.
import { useState } from "react";

function read<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : (JSON.parse(stored) as T);
  } catch {
    return fallback; // z. B. privates Fenster: dann eben Standardwert
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Nicht schlimm, dann wird es nur nicht gemerkt.
  }
}

// Wie useState, aber der Wert bleibt nach dem Neuladen erhalten.
export function usePersistentState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => read(key, fallback));
  const update = (next: T) => {
    setValue(next);
    write(key, next);
  };
  return [value, update] as const;
}
