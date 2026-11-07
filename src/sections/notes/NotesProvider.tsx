// Lädt Seiten und Fächer und stellt Funktionen zum Anlegen/Umbenennen/Löschen bereit.
import { useEffect, useState, type ReactNode } from "react";

import {
  deletePageData,
  loadPages,
  loadSubjects,
  savePages,
  saveSubjects,
  type Page,
  type Subject,
} from "../../storage/db";
import { NotesContext } from "./NotesContext";

export function NotesProvider({ children }: { children: ReactNode }) {
  const [pages, setPages] = useState<Page[] | null>(null); // null = lädt noch
  const [subjects, setSubjects] = useState<Subject[] | null>(null);

  useEffect(() => {
    loadPages().then(setPages);
    loadSubjects().then(setSubjects);
  }, []);

  if (pages === null || subjects === null) return null; // kurz beim Start

  // Jede Änderung sofort speichern.
  const updatePages = (next: Page[]) => {
    setPages(next);
    savePages(next);
  };
  const updateSubjects = (next: Subject[]) => {
    setSubjects(next);
    saveSubjects(next);
  };

  const createPage = (subjectId: string | null = null) => {
    const page: Page = { id: crypto.randomUUID(), title: "", subjectId };
    updatePages([...pages, page]);
    return page;
  };

  const renamePage = (id: string, title: string) => {
    updatePages(pages.map((p) => (p.id === id ? { ...p, title } : p)));
  };

  const deletePage = (id: string) => {
    const remaining = pages.filter((p) => p.id !== id);
    updatePages(remaining);
    deletePageData(id);
    return remaining;
  };

  const createSubject = () => {
    const subject: Subject = { id: crypto.randomUUID(), name: "" };
    updateSubjects([...subjects, subject]);
    return subject;
  };

  const renameSubject = (id: string, name: string) => {
    updateSubjects(subjects.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  const deleteSubject = (id: string) => {
    const doomed = pages.filter((p) => p.subjectId === id);
    doomed.forEach((p) => deletePageData(p.id));
    updatePages(pages.filter((p) => p.subjectId !== id));
    updateSubjects(subjects.filter((s) => s.id !== id));
  };

  return (
    <NotesContext.Provider
      value={{
        pages,
        subjects,
        createPage,
        renamePage,
        deletePage,
        createSubject,
        renameSubject,
        deleteSubject,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}
