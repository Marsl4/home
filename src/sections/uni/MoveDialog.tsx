// "Verschieben nach …": Zielordner auswählen (für Ordner, Notizen und PDFs).
import { useState, type ReactNode } from "react";

import { useNotes } from "../notes/NotesContext";
import { usePdfs } from "../pdfs/PdfsContext";
import { descendantIds } from "./folders";
import { MoveDialog } from "./MoveDialogView";

export type MoveTarget =
  | { kind: "folder"; id: string; name: string; parentId: string | null }
  | { kind: "page"; id: string; name: string; parentId: string | null }
  | { kind: "pdf"; id: string; name: string; parentId: string | null };

// Gibt eine Funktion zum Öffnen des Dialogs zurück und das Dialog-Element (irgendwo mit rendern).
export function useMoveDialog(): [(target: MoveTarget) => void, ReactNode] {
  const [target, setTarget] = useState<MoveTarget | null>(null);
  const { subjects, moveSubject, movePage } = useNotes();
  const { updatePdf } = usePdfs();

  const move = (folderId: string | null) => {
    if (!target) return;
    if (target.kind === "folder") moveSubject(target.id, folderId);
    if (target.kind === "page") movePage(target.id, folderId);
    if (target.kind === "pdf") updatePdf(target.id, { folderId });
    setTarget(null);
  };

  const dialog = target && (
    <MoveDialog
      target={target}
      folders={subjects}
      // Ordner nicht in sich selbst oder seine Unterordner
      forbidden={target.kind === "folder" ? new Set([target.id, ...descendantIds(subjects, target.id)]) : new Set()}
      onMove={move}
      onClose={() => setTarget(null)}
    />
  );
  return [setTarget, dialog];
}
