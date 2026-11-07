// Der Dialog "Verschieben nach …" selbst (Liste der Zielordner).
import type { ReactNode } from "react";
import { Folder, Home, X } from "lucide-react";

import type { Subject } from "../../storage/db";
import { childFolders } from "./folders";
import type { MoveTarget } from "./MoveDialog";

export function MoveDialog({
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
