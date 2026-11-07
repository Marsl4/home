// Hilfsfunktionen für die Ordnerstruktur (Ordner = "Subject", beliebig tief verschachtelt).
import type { Subject } from "../../storage/db";

export const parentOf = (folder: Subject) => folder.parentId ?? null;

const byName = (a: Subject, b: Subject) =>
  (a.name || "Ohne Namen").localeCompare(b.name || "Ohne Namen", "de", { numeric: true });

// Direkte Unterordner (alphabetisch, "Semester 2" vor "Semester 10").
export function childFolders(folders: Subject[], parentId: string | null): Subject[] {
  return folders.filter((f) => parentOf(f) === parentId).sort(byName);
}

// Alle Ordner unterhalb (Kinder, Enkel, …) – ohne den Ordner selbst.
export function descendantIds(folders: Subject[], id: string): Set<string> {
  const result = new Set<string>();
  const visit = (parentId: string) => {
    for (const child of folders.filter((f) => parentOf(f) === parentId)) {
      if (result.has(child.id)) continue; // Sicherheit gegen Schleifen
      result.add(child.id);
      visit(child.id);
    }
  };
  visit(id);
  return result;
}

// Pfad von oben bis zu diesem Ordner, z. B. [Semester 7, Steuern].
export function folderPath(folders: Subject[], id: string | null | undefined): Subject[] {
  const path: Subject[] = [];
  let current = folders.find((f) => f.id === id);
  while (current && !path.includes(current)) {
    path.unshift(current);
    current = folders.find((f) => f.id === parentOf(current!));
  }
  return path;
}
