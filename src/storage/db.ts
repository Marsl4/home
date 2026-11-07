// Alles, was die App speichert, läuft über diese Datei.
// Gespeichert wird in IndexedDB (Datenbank im Browser) über die kleine Bibliothek idb-keyval.
// Wenn wir später einen Server/Sync einbauen, müssen wir nur diese Datei austauschen.
import { del, get, set } from "idb-keyval";
import type { Stroke } from "../drawing/strokes";

export type Page = {
  id: string;
  title: string;
  subjectId?: string | null; // gehört zu einem Uni-Fach (oder null = allgemeine Notiz)
};

// Ein Uni-Fach, z. B. "Analysis". Seine Seiten sind normale Pages mit subjectId.
export type Subject = {
  id: string;
  name: string;
};

const PAGES_KEY = "pages";
const SUBJECTS_KEY = "subjects";
const contentKey = (pageId: string) => `page-content:${pageId}`;
const drawingKey = (pageId: string) => `page-drawing:${pageId}`;

export async function loadPages(): Promise<Page[]> {
  return (await get<Page[]>(PAGES_KEY)) ?? [];
}

export async function savePages(pages: Page[]): Promise<void> {
  await set(PAGES_KEY, pages);
}

export async function loadSubjects(): Promise<Subject[]> {
  return (await get<Subject[]>(SUBJECTS_KEY)) ?? [];
}

export async function saveSubjects(subjects: Subject[]): Promise<void> {
  await set(SUBJECTS_KEY, subjects);
}

// Inhalt einer Seite = Liste von Editor-Blöcken (Format von BlockNote).
export async function loadPageContent(pageId: string): Promise<unknown[] | undefined> {
  return get<unknown[]>(contentKey(pageId));
}

export async function savePageContent(pageId: string, blocks: unknown[]): Promise<void> {
  await set(contentKey(pageId), blocks);
}

// ---------- ToDos ----------
export type Todo = {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null; // "JJJJ-MM-TT" oder null = ohne Datum
  createdAt: number;
  doneAt: number | null;
};

const TODOS_KEY = "todos";

export async function loadTodos(): Promise<Todo[]> {
  return (await get<Todo[]>(TODOS_KEY)) ?? [];
}

export async function saveTodos(todos: Todo[]): Promise<void> {
  await set(TODOS_KEY, todos);
}

// Freihand-Zeichnungen einer Seite (Liste von Strichen, Format siehe drawing/strokes.ts).
export async function loadPageDrawing(pageId: string): Promise<Stroke[]> {
  return (await get<Stroke[]>(drawingKey(pageId))) ?? [];
}

export async function savePageDrawing(pageId: string, strokes: Stroke[]): Promise<void> {
  await set(drawingKey(pageId), strokes);
}

export async function deletePageData(pageId: string): Promise<void> {
  await del(contentKey(pageId));
  await del(drawingKey(pageId));
}
