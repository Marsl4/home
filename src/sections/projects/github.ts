// Verbindung zu GitHub: liest Hausarbeiten und Präsentationen, die in VS Code (mit Claude) entstehen.
// Jedes Projekt ist ein (privates) GitHub-Repository mit einer Datei "home.json" (siehe vorlagen/projekt).
// Die App liest nur – sie ändert auf GitHub nichts. Anfragen gehen direkt vom Gerät an GitHub.
import { useEffect, useState } from "react";

import { readStored } from "../../storage/uiState";

const API = "https://api.github.com";

// ---------- Zugang (Schlüssel) ----------
// Liegt wie der KI-Schlüssel nur in localStorage dieses Geräts – nicht in der Datenbank/Sicherung.
export type GithubSettings = { token: string; login: string };

const SETTINGS_KEY = "github:settings";
const CHANGED_EVENT = "github-settings-changed";

export function loadGithubSettings(): GithubSettings {
  return { token: "", login: "", ...readStored<Partial<GithubSettings>>(SETTINGS_KEY, {}) };
}

export function saveGithubSettings(settings: GithubSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // privates Fenster o. Ä.
  }
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: settings }));
}

export function useGithubSettings(): GithubSettings {
  const [settings, setSettings] = useState(loadGithubSettings);
  useEffect(() => {
    const onChange = (e: Event) => setSettings((e as CustomEvent<GithubSettings>).detail);
    window.addEventListener(CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CHANGED_EVENT, onChange);
  }, []);
  return settings;
}

// ---------- Fehler ----------
export class GithubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function describeGithubError(error: unknown): string {
  if (!navigator.onLine) return "Keine Internetverbindung – gezeigt wird der zuletzt geladene Stand.";
  if (error instanceof GithubError) {
    if (error.status === 401) return "Der GitHub-Schlüssel ist ungültig oder abgelaufen. Bitte in Einstellungen → GitHub einen neuen eintragen.";
    if (error.status === 403 && /rate limit/i.test(error.message))
      return "GitHub-Limit für Anfragen erreicht – bitte später nochmal laden.";
    if (error.status === 403 || error.status === 404)
      return "Kein Zugriff – der Schlüssel darf dieses Projekt nicht lesen. Bitte in Einstellungen → GitHub prüfen.";
    return `Fehler von GitHub (${error.status}): ${error.message}`;
  }
  if (error instanceof TypeError) return "Die Verbindung zu GitHub ist fehlgeschlagen. Bitte nochmal versuchen.";
  return `Fehler: ${error instanceof Error ? error.message : String(error)}`;
}

async function request(token: string, path: string, accept = "application/vnd.github+json"): Promise<Response> {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: accept },
    cache: "no-store", // immer den neuesten Stand
  });
  if (!response.ok) {
    let message = response.statusText;
    try {
      message = (await response.json())?.message ?? message;
    } catch {
      // keine lesbare Meldung
    }
    throw new GithubError(response.status, message);
  }
  return response;
}

const getJson = async <T>(token: string, path: string): Promise<T> => (await request(token, path)).json();

// Schlüssel prüfen: Wem gehört er?
export async function checkToken(token: string): Promise<string> {
  const user = await getJson<{ login: string }>(token, "/user");
  return user.login;
}

// ---------- Projekte ----------
export type ProjectType = "hausarbeit" | "praesentation";

export type ProjectTask = { text: string; erledigt: boolean };

export type Project = {
  repo: string; // "besitzer/name"
  url: string; // Link zum Repository
  pushedAt: number; // letzte Änderung (ms)
  typ: ProjectType;
  titel: string;
  fach?: string;
  abgabe?: string; // "2026-12-15"
  status?: string; // z. B. "Gliederung", "Schreiben", "Korrektur", "Fertig"
  ergebnis?: string; // Pfad zum Ergebnis-PDF im Projekt, z. B. "ausgabe/hausarbeit.pdf"
  umfang?: { ist?: number; ziel?: number; einheit?: string }; // z. B. Wörter oder Folien
  aufgaben: ProjectTask[];
};

type Repo = { full_name: string; html_url: string; pushed_at: string; archived: boolean };

// Alle Repositories durchsehen, die der Schlüssel lesen darf, und die mit "home.json" als Projekt nehmen.
export async function listProjects(token: string): Promise<Project[]> {
  const repos: Repo[] = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await getJson<Repo[]>(token, `/user/repos?per_page=100&sort=pushed&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  const projects = await Promise.all(
    repos
      .filter((repo) => !repo.archived)
      .map(async (repo) => {
        try {
          const response = await request(token, `/repos/${repo.full_name}/contents/home.json`, "application/vnd.github.raw");
          return parseProject(repo, await response.text());
        } catch (error) {
          if (error instanceof GithubError && error.status === 404) return null; // kein Projekt
          throw error;
        }
      }),
  );
  return projects.filter((p): p is Project => p !== null);
}

// home.json großzügig lesen: Fehlt etwas oder ist es falsch geschrieben, trotzdem anzeigen.
export function parseProject(repo: Repo, text: string): Project | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    data = {}; // kaputte Datei: Projekt trotzdem zeigen (mit Namen des Repositorys)
  }
  const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
  const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
  const typRaw = (str(data.typ) ?? "hausarbeit").toLowerCase();
  const umfang = data.umfang && typeof data.umfang === "object" ? (data.umfang as Record<string, unknown>) : null;
  return {
    repo: repo.full_name,
    url: repo.html_url,
    pushedAt: Date.parse(repo.pushed_at) || 0,
    typ: typRaw.startsWith("pr") ? "praesentation" : "hausarbeit",
    titel: str(data.titel) ?? repo.full_name.split("/")[1],
    fach: str(data.fach),
    abgabe: str(data.abgabe),
    status: str(data.status),
    ergebnis: str(data.ergebnis),
    umfang: umfang ? { ist: num(umfang.ist), ziel: num(umfang.ziel), einheit: str(umfang.einheit) } : undefined,
    aufgaben: Array.isArray(data.aufgaben)
      ? data.aufgaben
          .map((t) =>
            typeof t === "string"
              ? { text: t, erledigt: false }
              : { text: str((t as Record<string, unknown>)?.text) ?? "", erledigt: (t as Record<string, unknown>)?.erledigt === true },
          )
          .filter((t) => t.text)
      : [],
  };
}

// ---------- Änderungen und Versionen ----------
export type Change = { sha: string; message: string; date: number; author: string };

type CommitResponse = { sha: string; commit: { message: string; author: { name: string; date: string } } };

const toChange = (c: CommitResponse): Change => ({
  sha: c.sha,
  message: c.commit.message.split("\n")[0],
  date: Date.parse(c.commit.author.date) || 0,
  author: c.commit.author.name,
});

// Die letzten Änderungen am Projekt (neueste zuerst). Mit path: nur Änderungen an dieser Datei.
export async function loadChanges(token: string, repo: string, path?: string, count = 10): Promise<Change[]> {
  const filter = path ? `&path=${encodeURIComponent(path)}` : "";
  const commits = await getJson<CommitResponse[]>(token, `/repos/${repo}/commits?per_page=${count}${filter}`);
  return commits.map(toChange);
}

// Eine Datei in einem bestimmten Stand herunterladen.
export async function downloadFile(token: string, repo: string, path: string, ref: string): Promise<Blob> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const response = await request(token, `/repos/${repo}/contents/${encoded}?ref=${ref}`, "application/vnd.github.raw");
  return response.blob();
}
