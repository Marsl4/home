// "Verschieben nach …": Zielordner auswählen (für Ordner, Notizen und PDFs).
import { useState, type ReactNode } from "react";
import { Folder, Home, X } from "lucide-react";

import type { Subject } from "../../storage/db";
import { useNotes } from "../notes/NotesContext";
import { usePdfs } from "../pdfs/PdfsContext";
import { childFolders, descendantIds } from "./folders";

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

function MoveDialog({
  target,
  folders,
  forbidden,
  onMove,
  onClose,
}: {
  target: MoveTarget;
  folders: Subject[];
  forbidden: Set<string>;
  onMove: (folderId: string | null) => void;
  onClose: () => void;
}) {
  const renderLevel = (parentId: string | null, depth: number): ReactNode =>
    childFolders(folders, parentId)
      .filter((folder) => !forbidden.has(folder.id))
      .map((folder) => (
        <div key={folder.id}>
          <button
            className={`move-option ${folder.id === target.parentId ? "current" : ""}`}
            style={{ paddingLeft: 12 + depth * 18 }}
            onClick={() => onMove(folder.id)}
            disabled={folder.id === target.parentId}
          >
            <Folder size={15} /> {folder.name || "Ohne Namen"}
            {folder.id === target.parentId && <span className="move-here">(hier)</span>}
          </button>
          {renderLevel(folder.id, depth + 1)}
        </div>
      ));

  return (
    <div className="dialog-backdrop" onPointerDown={onClose}>
      <div className="dialog" onPointerDown={(e) => e.stopPropagation()}>
        <header className="dialog-header">
          <span>„{target.name || "Ohne Namen"}“ verschieben nach …</span>
          <button className="icon-button" onClick={onClose} title="Abbrechen">
            <X size={16} />
          </button>
        </header>
        <div className="move-list">
          {/* Notizen ohne Ordner landen im Bereich "Notizen", PDFs ohne Ordner unter PDFs */}
          <button
            className={`move-option ${target.parentId === null ? "current" : ""}`}
            onClick={() => onMove(null)}
            disabled={target.parentId === null}
          >
            <Home size={15} />
            {target.kind === "folder" ? "Oberste Ebene" : target.kind === "page" ? "Ohne Ordner (Notizen)" : "Ohne Ordner"}
          </button>
          {renderLevel(null, 0)}
          {folders.length === 0 && <p className="panel-hint">Noch keine Ordner angelegt.</p>}
        </div>
      </div>
    </div>
  );
}
