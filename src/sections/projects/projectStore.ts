// Zwischenspeicher für alles, was von GitHub kommt (Projektliste, Änderungen, Ergebnis-PDFs).
// Liegt in einer eigenen kleinen Datenbank: Er wird NICHT synchronisiert und ist NICHT im Backup –
// alles darin lässt sich jederzeit neu von GitHub laden. (Stift-Notizen auf den PDFs liegen dagegen
// ganz normal in db.ts und werden gesichert und synchronisiert.)
import { useEffect, useState, useSyncExternalStore } from "react";
import { createStore, del, get, set, type UseStore } from "idb-keyval";

import {
  downloadFile,
  listProjects,
  loadChanges,
  loadGithubSettings,
  type Change,
  type Project,
} from "./github";

const cache: UseStore = createStore("home-projects", "cache");

// ---------- Projektliste (für alle Ansichten gemeinsam) ----------
type ListState = {
  projects: Project[] | null; // null = noch nichts geladen
  loadedAt: number | null;
  loading: boolean;
  error: unknown;
};

let state: ListState = { projects: null, loadedAt: null, loading: false, error: null };
const listeners = new Set<() => void>();
const setState = (change: Partial<ListState>) => {
  state = { ...state, ...change };
  listeners.forEach((listener) => listener());
};

let cacheRead = false;
async function readCachedList() {
  if (cacheRead) return;
  cacheRead = true;
  const cached = await get<{ projects: Project[]; loadedAt: number }>("projects", cache);
  if (cached && state.projects === null) setState({ projects: cached.projects, loadedAt: cached.loadedAt });
}

// Neu von GitHub laden. Ohne force nur, wenn der letzte Stand älter als eine Minute ist.
export async function refreshProjects(force = false) {
  const { token } = loadGithubSettings();
  if (!token || state.loading) return;
  if (!force && state.loadedAt && Date.now() - state.loadedAt < 60_000) return;
  setState({ loading: true, error: null });
  try {
    const projects = await listProjects(token);
    const loadedAt = Date.now();
    setState({ projects, loadedAt, loading: false });
    await set("projects", { projects, loadedAt }, cache);
  } catch (error) {
    setState({ loading: false, error });
  }
}

export function useProjects() {
  const snapshot = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
  useEffect(() => {
    readCachedList().then(() => refreshProjects());
  }, []);
  return snapshot;
}

// Beim Wechsel des Schlüssels: alten Stand vergessen.
export async function forgetProjects() {
  setState({ projects: null, loadedAt: null, error: null });
  await del("projects", cache);
}

// ---------- Änderungen und Versionen eines Projekts ----------
export type ProjectDetails = {
  changes: Change[]; // letzte Änderungen am ganzen Projekt
  versions: Change[]; // Stände, in denen sich das Ergebnis-PDF geändert hat (neueste zuerst)
};

export function useProjectDetails(project: Project | undefined) {
  const [details, setDetails] = useState<ProjectDetails | null>(null);
  const [error, setError] = useState<unknown>(null);
  const repo = project?.repo;
  const result = project?.ergebnis;
  // pushedAt: lädt neu, sobald die Projektliste eine neuere Änderung meldet
  const pushedAt = project?.pushedAt;
  // Für welchen Stand die letzte Anfrage fertig ist – daraus ergibt sich "lädt noch".
  const requestKey = `${repo}|${result}|${pushedAt}`;
  const [finishedKey, setFinishedKey] = useState<string | null>(null);
  const loading = !!repo && !!loadGithubSettings().token && finishedKey !== requestKey;

  useEffect(() => {
    if (!repo) return;
    let cancelled = false;
    const key = `details:${repo}`;
    get<ProjectDetails>(key, cache).then((cached) => {
      if (!cancelled && cached) setDetails(cached);
    });
    const { token } = loadGithubSettings();
    if (!token) return;
    Promise.all([loadChanges(token, repo), result ? loadChanges(token, repo, result) : Promise.resolve([])])
      .then(async ([changes, versions]) => {
        if (cancelled) return;
        const next = { changes, versions };
        setDetails(next);
        setError(null);
        await set(key, next, cache);
      })
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setFinishedKey(`${repo}|${result}|${pushedAt}`));
    return () => {
      cancelled = true;
    };
  }, [repo, result, pushedAt]);

  return { details, error, loading };
}

// ---------- Ergebnis-PDFs ----------
// Bereits geladene Versionen bleiben im Zwischenspeicher (die zuletzt benutzten MAX_FILES).
const MAX_FILES = 6;
const fileKey = (repo: string, sha: string) => `file:${repo}@${sha}`;

// Läuft dieselbe Datei schon, nicht ein zweites Mal herunterladen.
const downloading = new Map<string, Promise<Blob | undefined>>();

export function loadResultFile(repo: string, path: string, sha: string): Promise<Blob | undefined> {
  const key = fileKey(repo, sha);
  const running = downloading.get(key);
  if (running) return running;
  const task = fetchResultFile(repo, path, sha, key).finally(() => downloading.delete(key));
  downloading.set(key, task);
  return task;
}

async function fetchResultFile(repo: string, path: string, sha: string, key: string): Promise<Blob | undefined> {
  const cached = await get<Blob>(key, cache);
  if (cached) {
    await rememberUse(key);
    return cached;
  }
  const { token } = loadGithubSettings();
  if (!token) return undefined;
  const blob = await downloadFile(token, repo, path, sha);
  // pdf.js braucht den Dateityp nicht, aber für "Herunterladen" ist er schöner.
  const file = new Blob([blob], { type: "application/pdf" });
  await set(key, file, cache);
  await rememberUse(key);
  return file;
}

async function rememberUse(key: string) {
  const used = (await get<{ key: string; at: number }[]>("files-used", cache)) ?? [];
  const next = [{ key, at: Date.now() }, ...used.filter((u) => u.key !== key)];
  for (const old of next.slice(MAX_FILES)) await del(old.key, cache);
  await set("files-used", next.slice(0, MAX_FILES), cache);
}
