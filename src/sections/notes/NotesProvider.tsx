// Lädt die Seitenliste und stellt Funktionen zum Anlegen/Umbenennen/Löschen bereit.
import { useEffect, useState, type ReactNode } from "react";

import { deletePageData, loadPages, savePages, type Page } from "../../storage/db";
import { NotesContext } from "./NotesContext";

export function NotesProvider({ children }: { children: ReactNode }) {
  const [pages, setPages] = useState<Page[] | null>(null); // null = lädt noch

  useEffect(() => {
    loadPages().then(setPages);
  }, []);

  if (pages === null) return null; // kurz beim Start

  // Seitenliste ändern = sofort speichern.
  const update = (next: Page[]) => {
    setPages(next);
    savePages(next);
  };

  const createPage = () => {
    const page: Page = { id: crypto.randomUUID(), title: "" };
    update([...pages, page]);
    return page;
  };

  const renamePage = (id: string, title: string) => {
    update(pages.map((p) => (p.id === id ? { ...p, title } : p)));
  };

  const deletePage = (id: string) => {
    const remaining = pages.filter((p) => p.id !== id);
    update(remaining);
    deletePageData(id);
    return remaining;
  };

  return (
    <NotesContext.Provider value={{ pages, createPage, renamePage, deletePage }}>
      {children}
    </NotesContext.Provider>
  );
}
