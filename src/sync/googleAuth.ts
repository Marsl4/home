// Anmeldung bei Google (offizielle Bibliothek "Google Identity Services", wird direkt von Google geladen).
// Google gibt reinen Web-Apps nur einen Zugang für eine Stunde – danach einmal "Sync" tippen.
import { clientId } from "./config";

// Nur der Zugriff auf den eigenen, versteckten App-Ordner in Drive (nicht auf deine anderen Dateien).
const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const TOKEN_KEY = "sync:token";

type StoredToken = { token: string; expiresAt: number };

type TokenResponse = { access_token?: string; expires_in?: number; error?: string };
type TokenClient = { requestAccessToken: (options?: { prompt?: string }) => void };
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type: string; message?: string }) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Google-Anmeldung konnte nicht geladen werden (Internet?)."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// Beim App-Start schon laden, damit der Klick auf "Sync" sofort das Google-Fenster öffnen kann
// (Safari erlaubt Fenster nur direkt beim Klick).
export function preloadGoogle() {
  if (clientId()) loadScript().catch(() => {});
}

export function storedToken(): string | null {
  try {
    const stored = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? "null") as StoredToken | null;
    return stored && stored.expiresAt > Date.now() + 60_000 ? stored.token : null;
  } catch {
    return null;
  }
}

export function forgetToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // egal
  }
}

// Öffnet (falls nötig) das Google-Fenster und liefert einen Zugang. Muss direkt aus einem Klick kommen.
export function requestToken(firstTime: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const google = window.google;
    if (!google) {
      loadScript().catch(reject);
      reject(new Error("Google-Anmeldung lädt noch – bitte gleich nochmal tippen."));
      return;
    }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId(),
      scope: SCOPE,
      callback: (response) => {
        if (!response.access_token) {
          reject(new Error(response.error ?? "Anmeldung abgebrochen"));
          return;
        }
        const stored: StoredToken = {
          token: response.access_token,
          expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
        };
        try {
          localStorage.setItem(TOKEN_KEY, JSON.stringify(stored));
        } catch {
          // dann gilt er nur bis zum Neuladen
        }
        resolve(stored.token);
      },
      error_callback: (error) =>
        reject(new Error(error.type === "popup_closed" ? "Anmeldefenster geschlossen" : error.message ?? error.type)),
    });
    client.requestAccessToken({ prompt: firstTime ? "consent" : "" });
  });
}
