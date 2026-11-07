// Gemeinsamer Zustand für alle Notizseiten und Uni-Fächer.
// Wird vom Notizen-Bereich und vom Uni-Bereich benutzt.
import { createContext, useContext } from "react";
import type { Page, Subject } from "../../storage/db";

export type NotesState = {
  pages: Page[];
  subjects: Subject[];
  createPage: (subjectId?: string | null) => Page;
  renamePage: (id: string, title: string) => void;
  deletePage: (id: string) => Page[]; // gibt die übrigen Seiten zurück
  createSubject: () => Subject;
  renameSubject: (id: string, name: string) => void;
  deleteSubject: (id: string) => void; // löscht auch alle Seiten des Fachs
};

export const NotesContext = createContext<NotesState | null>(null);

export function useNotes(): NotesState {
  const notes = useContext(NotesContext);
  if (!notes) throw new Error("useNotes muss innerhalb von <NotesProvider> benutzt werden");
  return notes;
}

// Allgemeine Notizen = Seiten ohne Fach.
export function generalPages(pages: Page[]): Page[] {
  return pages.filter((p) => !p.subjectId);
}

export function pagesOfSubject(pages: Page[], subjectId: string): Page[] {
  return pages.filter((p) => p.subjectId === subjectId);
}

// Welche Seite ist offen? Die ausgewählte, sonst die erste.
export function resolvePageId(pages: Page[], selectedId: string | null): string | null {
  return pages.some((p) => p.id === selectedId) ? selectedId : (pages[0]?.id ?? null);
}
