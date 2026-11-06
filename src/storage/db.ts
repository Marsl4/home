// Alles, was die App speichert, läuft über diese Datei.
// Gespeichert wird in IndexedDB (Datenbank im Browser) über die kleine Bibliothek idb-keyval.
// Wenn wir später einen Server/Sync einbauen, müssen wir nur diese Datei austauschen.
import { del, get, set } from "idb-keyval";

export type Page = {
  id: string;
  title: string;
};

const PAGES_KEY = "pages";
const contentKey = (pageId: string) => `page-content:${pageId}`;

export async function loadPages(): Promise<Page[]> {
  return (await get<Page[]>(PAGES_KEY)) ?? [];
}

export async function savePages(pages: Page[]): Promise<void> {
  await set(PAGES_KEY, pages);
}

// Inhalt einer Seite = Liste von Editor-Blöcken (Format von BlockNote).
export async function loadPageContent(pageId: string): Promise<unknown[] | undefined> {
  return get<unknown[]>(contentKey(pageId));
}

export async function savePageContent(pageId: string, blocks: unknown[]): Promise<void> {
  await set(contentKey(pageId), blocks);
}

export async function deletePageContent(pageId: string): Promise<void> {
  await del(contentKey(pageId));
}
