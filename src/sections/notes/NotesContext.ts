// Gemeinsamer Zustand des Notizen-Bereichs (Seitenliste), den Leiste und Ansicht beide brauchen.
import { createContext, useContext } from "react";
import type { Page } from "../../storage/db";

export type NotesState = {
  pages: Page[];
  createPage: () => Page;
  renamePage: (id: string, title: string) => void;
  deletePage: (id: string) => Page[]; // gibt die übrigen Seiten zurück
};

export const NotesContext = createContext<NotesState | null>(null);

export function useNotes(): NotesState {
  const notes = useContext(NotesContext);
  if (!notes) throw new Error("useNotes muss innerhalb von <NotesProvider> benutzt werden");
  return notes;
}

// Welche Seite ist offen? Die ausgewählte, sonst die erste.
export function resolvePageId(pages: Page[], selectedId: string | null): string | null {
  return pages.some((p) => p.id === selectedId) ? selectedId : (pages[0]?.id ?? null);
}
