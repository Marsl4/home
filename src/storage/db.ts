// Alles, was die App speichert, läuft über diese Datei.
// Gespeichert wird in IndexedDB (Datenbank im Browser) über die kleine Bibliothek idb-keyval.
// Wenn wir später einen Server/Sync einbauen, müssen wir nur diese Datei austauschen.
import { get } from "idb-keyval";
import { trackedDel as del, trackedSet as set } from "../sync/tracker"; // Speichern + für den Sync vermerken
import type { FloatingImage } from "../drawing/images";
import type { FloatingText } from "../drawing/texts";
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
const imagesKey = (pageId: string) => `page-images:${pageId}`;
const textsKey = (pageId: string) => `page-texts:${pageId}`;

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

// Frei platzierte Bilder einer Seite (Format siehe drawing/images.ts).
export async function loadPageImages(pageId: string): Promise<FloatingImage[]> {
  return (await get<FloatingImage[]>(imagesKey(pageId))) ?? [];
}

export async function savePageImages(pageId: string, images: FloatingImage[]): Promise<void> {
  await set(imagesKey(pageId), images);
}

// Frei platzierte Textfelder einer Seite (Format siehe drawing/texts.ts).
export async function loadPageTexts(pageId: string): Promise<FloatingText[]> {
  return (await get<FloatingText[]>(textsKey(pageId))) ?? [];
}

export async function savePageTexts(pageId: string, texts: FloatingText[]): Promise<void> {
  await set(textsKey(pageId), texts);
}

export async function deletePageData(pageId: string): Promise<void> {
  await del(contentKey(pageId));
  await del(drawingKey(pageId));
  await del(imagesKey(pageId));
  await del(textsKey(pageId));
}

// ---------- PDFs ----------
export type PdfDoc = {
  id: string;
  name: string;
  addedAt: number;
  lastOpenedAt: number | null;
  favorite: boolean;
};

// Striche auf einem PDF: Seitennummer (ab 0) -> Striche in PDF-Koordinaten.
export type PdfInk = Record<number, Stroke[]>;

const PDFS_KEY = "pdfs";
const pdfFileKey = (id: string) => `pdf-file:${id}`;
const pdfInkKey = (id: string) => `pdf-ink:${id}`;

export async function loadPdfs(): Promise<PdfDoc[]> {
  return (await get<PdfDoc[]>(PDFS_KEY)) ?? [];
}

export async function savePdfs(pdfs: PdfDoc[]): Promise<void> {
  await set(PDFS_KEY, pdfs);
}

// Die PDF-Datei selbst (wird als Ganzes im Browser gespeichert).
export async function loadPdfFile(id: string): Promise<Blob | undefined> {
  return get<Blob>(pdfFileKey(id));
}

export async function savePdfFile(id: string, file: Blob): Promise<void> {
  await set(pdfFileKey(id), file);
}

export async function loadPdfInk(id: string): Promise<PdfInk> {
  return (await get<PdfInk>(pdfInkKey(id))) ?? {};
}

export async function savePdfInk(id: string, ink: PdfInk): Promise<void> {
  await set(pdfInkKey(id), ink);
}

export async function deletePdfData(id: string): Promise<void> {
  await del(pdfFileKey(id));
  await del(pdfInkKey(id));
}
