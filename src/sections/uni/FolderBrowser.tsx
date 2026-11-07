// Dokumenten-Übersicht (wie in Goodnotes): große Kacheln für Ordner, Notizen und PDFs.
// Oberste Ebene = alle obersten Ordner. Ordner antippen = hineingehen. Notiz/PDF antippen = öffnen.
// Wird im Uni-Bereich (alles) und im PDF-Bereich (nur Ordner + PDFs) benutzt.
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { FolderPlus, MoreHorizontal, NotebookPen, Plus, Upload } from "lucide-react";

import type { Page, PdfDoc, Subject } from "../../storage/db";
import { useNotes } from "../notes/NotesContext";
import { usePdfs } from "../pdfs/PdfsContext";
import { childFolders, folderPath } from "./folders";
import { useMoveDialog } from "./MoveDialog";

// Wohin ein Klick führt – je nach Bereich unterschiedlich.
export type BrowserNavigation = {
  root: () => void;
  folder: (id: string) => void;
  page: (id: string) => void;
  pdf: (id: string) => void;
};

type Props = {
  mode: "uni" | "pdfs";
  folder: Subject | null; // null = oberste Ebene
  nav: BrowserNavigation;
};

const formatDate = (ms?: number | null) =>
  ms
    ? new Date(ms).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

export function FolderBrowser({ mode, folder, nav }: Props) {
  const { subjects, pages, createPage, createSubject, renameSubject, renamePage, deleteSubject, deletePage } = useNotes();
  const { pdfs, importFiles, updatePdf, deletePdf } = usePdfs();
  const [openMove, moveDialog] = useMoveDialog();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderId = folder?.id ?? null;

  const subfolders = childFolders(subjects, folderId);
  const folderPages = folder && mode === "uni" ? pages.filter((p) => p.subjectId === folder.id) : [];
  // PDF-Bereich, oberste Ebene: auch PDFs ohne (vorhandenen) Ordner.
  const folderPdfs = folder
    ? pdfs.filter((p) => p.folderId === folder.id)
    : mode === "pdfs"
      ? pdfs.filter((p) => !p.folderId || !subjects.some((f) => f.id === p.folderId))
      : [];
  const rootLabel = mode === "uni" ? "Uni" : "PDFs";

  const openPdf = (id: string) => {
    updatePdf(id, { lastOpenedAt: Date.now() });
    nav.pdf(id);
  };

  const newFolder = () => {
    const name = window.prompt("Name des neuen Ordners:", "");
    if (name === null) return;
    renameSubject(createSubject(folderId).id, name.trim());
  };

  // Ordner löschen: samt Inhalt (PDFs in den gelöschten Ordnern mit).
  const removeFolder = (target: Subject) => {
    if (!window.confirm(`Ordner "${target.name || "Ohne Namen"}" mit allem darin wirklich löschen?`)) return;
    const removed = deleteSubject(target.id);
    pdfs.filter((p) => p.folderId && removed.has(p.folderId)).forEach((p) => deletePdf(p.id));
    if (target.id !== folderId) return;
    if (target.parentId) nav.folder(target.parentId);
    else nav.root();
  };

  const path = folder ? folderPath(subjects, folder.id) : [];
  const empty = subfolders.length + folderPages.length + folderPdfs.length === 0;

  return (
    <div className="browser">
      <div className="browser-inner">
        {/* Pfad: Uni › 7. Semester › Steuern */}
        {folder && (
          <div className="browser-path">
            <button className="breadcrumb-link" onClick={nav.root}>
              {rootLabel}
            </button>
            {path.slice(0, -1).map((f) => (
              <Fragment key={f.id}>
                <span className="breadcrumb-separator">›</span>
                <button className="breadcrumb-link" onClick={() => nav.folder(f.id)}>
                  {f.name || "Ohne Namen"}
                </button>
              </Fragment>
            ))}
          </div>
        )}

        <header className="browser-header">
          {folder ? (
            <input
              className="browser-title"
              value={folder.name}
              placeholder="Name des Ordners"
              autoFocus={!folder.name}
              onChange={(e) => renameSubject(folder.id, e.target.value)}
            />
          ) : (
            <h1 className="browser-title">{rootLabel}</h1>
          )}
          <div className="browser-actions">
            <Menu
              trigger={
                <span className="primary-button">
                  <Plus size={16} /> Neu
                </span>
              }
              items={[
                { label: "Ordner", icon: <FolderPlus size={15} />, onClick: newFolder },
                ...(folder && mode === "uni"
                  ? [{ label: "Notiz", icon: <NotebookPen size={15} />, onClick: () => nav.page(createPage(folder.id).id) }]
                  : []),
                // Im Uni-Bereich gehören PDFs in einen Ordner; im PDF-Bereich geht es auch ganz oben.
                ...(folder || mode === "pdfs"
                  ? [{ label: "PDF importieren", icon: <Upload size={15} />, onClick: () => fileInput.current?.click() }]
                  : []),
              ]}
            />
            {folder && (
              <Menu
                trigger={
                  <span className="icon-button browser-more" title="Mehr">
                    <MoreHorizontal size={18} />
                  </span>
                }
                items={[
                  { label: "Verschieben …", onClick: () => openMove({ kind: "folder", id: folder.id, name: folder.name, parentId: folder.parentId ?? null }) },
                  { label: "Ordner löschen", danger: true, onClick: () => removeFolder(folder) },
                ]}
              />
            )}
          </div>
        </header>

        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            const added = await importFiles(files, folderId);
            if (added[0]) openPdf(added[0].id);
          }}
        />

        {empty && (
          <p className="browser-empty">
            {folder
              ? `Dieser Ordner ist noch leer – über „Neu“ kannst du ${mode === "uni" ? "Ordner, Notizen und PDFs" : "Ordner und PDFs"} hinzufügen.`
              : mode === "uni"
                ? "Noch keine Ordner. Lege über „Neu“ z. B. „7. Semester“ an."
                : "Noch keine PDFs. Über „Neu“ kannst du PDFs importieren oder Ordner anlegen – oder ein PDF hierher ziehen."}
          </p>
        )}

        <div className="browser-grid">
          {subfolders.map((sub) => (
            <Tile
              key={sub.id}
              kind="folder"
              name={sub.name || "Ohne Namen"}
              date={formatDate(sub.createdAt)}
              onOpen={() => nav.folder(sub.id)}
              menu={[
                { label: "Verschieben …", onClick: () => openMove({ kind: "folder", id: sub.id, name: sub.name, parentId: sub.parentId ?? null }) },
                { label: "Löschen", danger: true, onClick: () => removeFolder(sub) },
              ]}
            />
          ))}
          {folderPages.map((page: Page) => (
            <Tile
              key={page.id}
              kind="note"
              name={page.title || "Ohne Titel"}
              date={formatDate(page.createdAt)}
              onOpen={() => nav.page(page.id)}
              menu={[
                {
                  label: "Umbenennen …",
                  onClick: () => {
                    const name = window.prompt("Neuer Name:", page.title);
                    if (name !== null) renamePage(page.id, name.trim());
                  },
                },
                { label: "Verschieben …", onClick: () => openMove({ kind: "page", id: page.id, name: page.title, parentId: page.subjectId ?? null }) },
                {
                  label: "Löschen",
                  danger: true,
                  onClick: () => window.confirm(`Notiz "${page.title || "Ohne Titel"}" wirklich löschen?`) && deletePage(page.id),
                },
              ]}
            />
          ))}
          {folderPdfs.map((pdf: PdfDoc) => (
            <Tile
              key={pdf.id}
              kind="pdf"
              name={pdf.name || "Ohne Namen"}
              date={formatDate(pdf.addedAt)}
              favorite={pdf.favorite}
              onOpen={() => openPdf(pdf.id)}
              menu={[
                {
                  label: "Umbenennen …",
                  onClick: () => {
                    const name = window.prompt("Neuer Name:", pdf.name);
                    if (name !== null) updatePdf(pdf.id, { name: name.trim() });
                  },
                },
                { label: "Verschieben …", onClick: () => openMove({ kind: "pdf", id: pdf.id, name: pdf.name, parentId: pdf.folderId ?? null }) },
                {
                  label: "Löschen",
                  danger: true,
                  onClick: () => window.confirm(`PDF "${pdf.name}" samt Notizen darauf wirklich löschen?`) && deletePdf(pdf.id),
                },
              ]}
            />
          ))}
        </div>
      </div>
      {moveDialog}
    </div>
  );
}

// ---------- Kachel ----------
type MenuItem = { label: string; icon?: ReactNode; danger?: boolean; onClick: () => void };

function Tile({
  kind,
  name,
  date,
  favorite,
  onOpen,
  menu,
}: {
  kind: "folder" | "note" | "pdf";
  name: string;
  date: string;
  favorite?: boolean;
  onOpen: () => void;
  menu: MenuItem[];
}) {
  return (
    <div className="tile">
      <button className="tile-open" onClick={onOpen} title={name}>
        {/* Symbole aus einfachen Kästchen (kein SVG) – sehen in jedem Safari gleich aus */}
        {kind === "folder" ? (
          <span className="tile-folder">
            <span className="tile-folder-tab" />
            <span className="tile-folder-front" />
          </span>
        ) : (
          <span className={`tile-doc ${kind}`}>
            {kind === "pdf" ? <span className="tile-doc-badge">PDF</span> : <span className="tile-doc-lines" />}
            {favorite && <span className="tile-star">★</span>}
          </span>
        )}
        <span className="tile-name">{name}</span>
        {date && <span className="tile-date">{date}</span>}
      </button>
      <Menu
        trigger={
          <span className="tile-menu" title="Mehr">
            <MoreHorizontal size={16} />
          </span>
        }
        items={menu}
      />
    </div>
  );
}

// ---------- Kleines Aufklapp-Menü ----------
function Menu({ trigger, items }: { trigger: ReactNode; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <button className="menu-trigger" onClick={() => setOpen(!open)}>
        {trigger}
      </button>
      {open && (
        <div className="menu-popup">
          {items.map((item) => (
            <button
              key={item.label}
              className={`menu-item ${item.danger ? "danger" : ""}`}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
