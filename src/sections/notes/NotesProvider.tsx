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
import { useLiveSync } from "../../storage/liveSync";
import { descendantIds } from "../uni/folders";
import { NotesContext } from "./NotesContext";

export function NotesProvider({ children }: { children: ReactNode }) {
  const [pages, setPages] = useState<Page[] | null>(null); // null = lädt noch
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  // Vom anderen Gerät (Sync) geänderte Listen sofort übernehmen.
  useLiveSync<Page[]>("pages", setPages);
  useLiveSync<Subject[]>("subjects", setSubjects);

  useEffect(() => {
    loadPages().then(setPages);
    loadSubjects().then(setSubjects);
  }, []);

  if (pages === null || subjects === null) return null; // kurz beim Start

  // Jede Änderung baut auf dem neuesten Stand auf und wird sofort gespeichert.
  const updatePages = (change: (current: Page[]) => Page[]) =>
    setPages((current) => {
      const next = change(current ?? []);
      savePages(next);
      return next;
    });
  const updateSubjects = (change: (current: Subject[]) => Subject[]) =>
    setSubjects((current) => {
      const next = change(current ?? []);
      saveSubjects(next);
      return next;
    });

  const createPage = (subjectId: string | null = null) => {
    const page: Page = { id: crypto.randomUUID(), title: "", subjectId, createdAt: Date.now() };
    updatePages((current) => [...current, page]);
    return page;
  };

  const renamePage = (id: string, title: string) => {
    updatePages((current) => current.map((p) => (p.id === id ? { ...p, title } : p)));
  };

  const deletePage = (id: string) => {
    const remaining = pages.filter((p) => p.id !== id);
    updatePages((current) => current.filter((p) => p.id !== id));
    deletePageData(id);
    return remaining;
  };

  const movePage = (id: string, folderId: string | null) => {
    updatePages((current) => current.map((p) => (p.id === id ? { ...p, subjectId: folderId } : p)));
  };

  const createSubject = (parentId: string | null = null) => {
    const subject: Subject = { id: crypto.randomUUID(), name: "", parentId, createdAt: Date.now() };
    updateSubjects((current) => [...current, subject]);
    return subject;
  };

  const renameSubject = (id: string, name: string) => {
    updateSubjects((current) => current.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  const moveSubject = (id: string, parentId: string | null) => {
    // Nie in sich selbst oder einen eigenen Unterordner (sonst entstünde eine Schleife).
    if (parentId === id || (parentId && descendantIds(subjects, id).has(parentId))) return;
    updateSubjects((current) => current.map((s) => (s.id === id ? { ...s, parentId } : s)));
  };

  const deleteSubject = (id: string) => {
    const folderIds = new Set([id, ...descendantIds(subjects, id)]);
    const doomed = pages.filter((p) => p.subjectId && folderIds.has(p.subjectId));
    doomed.forEach((p) => deletePageData(p.id));
    updatePages((current) => current.filter((p) => !(p.subjectId && folderIds.has(p.subjectId))));
    updateSubjects((current) => current.filter((s) => !folderIds.has(s.id)));
    return folderIds;
  };

  return (
    <NotesContext.Provider
      value={{
        pages,
        subjects,
        createPage,
        renamePage,
        deletePage,
        movePage,
        createSubject,
        renameSubject,
        moveSubject,
        deleteSubject,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}
