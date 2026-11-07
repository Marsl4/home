// KI-Einstellungen: API-Schlüssel und gewähltes Modell.
// Liegen bewusst nur im Browser (localStorage) dieses Geräts – nicht in der Datenbank,
// damit der Schlüssel auch nicht in Sicherungsdateien landet.
import { useEffect, useState } from "react";

import { readStored } from "../storage/uiState";

export type AiSettings = {
  apiKey: string;
  model: string;
  // false (Standard) = schnell: die KI "denkt" vor der Antwort nur kurz nach.
  // true = gründlich: mehr Nachdenken, dafür längere Wartezeit.
  thorough?: boolean;
};

// "gemini-flash-latest" zeigt bei Google immer auf das aktuelle schnelle Modell (gratis nutzbar).
export const DEFAULT_MODEL = "gemini-flash-latest";

const KEY = "ai:settings";
const CHANGED_EVENT = "ai-settings-changed";

export function loadAiSettings(): AiSettings {
  return { apiKey: "", model: DEFAULT_MODEL, ...readStored<Partial<AiSettings>>(KEY, {}) };
}

export function saveAiSettings(settings: AiSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // privates Fenster o. Ä. – dann gilt die Einstellung nur bis zum Neuladen
  }
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: settings }));
}

// Aktuelle Einstellungen; aktualisiert sich, wenn sie woanders (z. B. in den Einstellungen) geändert werden.
export function useAiSettings(): AiSettings {
  const [settings, setSettings] = useState(loadAiSettings);
  useEffect(() => {
    const onChange = (e: Event) => setSettings((e as CustomEvent<AiSettings>).detail);
    window.addEventListener(CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CHANGED_EVENT, onChange);
  }, []);
  return settings;
}
