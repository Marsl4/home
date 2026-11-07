// Aufklappbarer Ordnerbaum für die Seitenleiste.
// - Uni: Ordner mit ihren Unterordnern, Notizen und PDFs
// - PDFs: dieselben Ordner, aber nur mit den PDFs darin (plus PDFs ohne Ordner)
import type { ReactNode } from "react";
import { ChevronRight, FileText, Folder, FolderInput, NotebookPen, Plus, Star, Upload, X } from "lucide-react";

import type { Page, PdfDoc, Subject } from "../../storage/db";
import { usePersistentState } from "../../storage/uiState";
import { ImportPdfButton } from "../pdfs/ImportPdfButton";
import { childFolders } from "./folders";
import type { MoveTarget } from "./MoveDialog";

type Props = {
  mode: "uni" | "pdfs";
  folders: Subject[];
  pages: Page[]; // nur im Uni-Modus angezeigt
  pdfs: PdfDoc[];
  activeId: string | null; // ID des ausgewählten Ordners/der Notiz/des PDFs
  onOpenFolder?: (id: string) => void; // Uni: Ordner-Übersicht öffnen
  onOpenPage?: (id: string) => void;
  onOpenPdf: (id: string) => void;
  onNewPage?: (folderId: string) => void;
  onImported: (added: PdfDoc[]) => void;
  onMove: (target: MoveTarget) => void;
  onDeletePage?: (page: Page) => void;
  onDeletePdf: (pdf: PdfDoc) => void;
};

const indent = (depth: number) => ({ paddingLeft: 8 + depth * 16 });

export function FolderTree(props: Props) {
  const { mode, folders, pages, pdfs, activeId } = props;
  // Welche Ordner zugeklappt sind (Standard: aufgeklappt) – getrennt für Uni und PDFs.
  const [collapsed, setCollapsed] = usePersistentState<Record<string, boolean>>(
    mode === "uni" ? "ui:uniCollapsed" : "ui:pdfFoldersCollapsed",
    {},
  );
  const toggle = (id: string) => setCollapsed({ ...collapsed, [id]: !collapsed[id] });
  const open = (id: string) => setCollapsed({ ...collapsed, [id]: false });

  const actionButton = (title: string, icon: ReactNode, onClick: () => void) => (
    <button
      className="panel-item-action"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {icon}
    </button>
  );

  const pdfRow = (pdf: PdfDoc, depth: number) => (
    <div
      key={pdf.id}
      className={`panel-item ${pdf.id === activeId ? "active" : ""}`}
      style={indent(depth)}
      onClick={() => props.onOpenPdf(pdf.id)}
    >
      <FileText size={15} className="panel-item-icon pdf-icon" />
      <span className="panel-item-label">{pdf.name || "Ohne Namen"}</span>
      {pdf.favorite && <Star size={12} className="panel-item-star" fill="currentColor" />}
      {actionButton("Verschieben", <FolderInput size={14} />, () =>
        props.onMove({ kind: "pdf", id: pdf.id, name: pdf.name, parentId: pdf.folderId ?? null }),
      )}
      {actionButton("PDF löschen", <X size={14} />, () => props.onDeletePdf(pdf))}
    </div>
  );

  const pageRow = (page: Page, depth: number) => (
    <div
      key={page.id}
      className={`panel-item ${page.id === activeId ? "active" : ""}`}
      style={indent(depth)}
      onClick={() => props.onOpenPage?.(page.id)}
    >
      <NotebookPen size={15} className="panel-item-icon" />
      <span className="panel-item-label">{page.title || "Ohne Titel"}</span>
      {actionButton("Verschieben", <FolderInput size={14} />, () =>
        props.onMove({ kind: "page", id: page.id, name: page.title, parentId: page.subjectId ?? null }),
      )}
      {actionButton("Notiz löschen", <X size={14} />, () => props.onDeletePage?.(page))}
    </div>
  );

  const folderNode = (folder: Subject, depth: number): ReactNode => {
    const isOpen = !collapsed[folder.id];
    return (
      <div key={folder.id}>
        <div
          className={`panel-item ${folder.id === activeId ? "active" : ""}`}
          style={indent(depth)}
          onClick={() => (props.onOpenFolder ? props.onOpenFolder(folder.id) : toggle(folder.id))}
        >
          <button
            className={`panel-chevron ${isOpen ? "open" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              toggle(folder.id);
            }}
            title={isOpen ? "Zuklappen" : "Aufklappen"}
          >
            <ChevronRight size={14} />
          </button>
          <Folder size={15} className="panel-item-icon" />
          <span className="panel-item-label">{folder.name || "Ohne Namen"}</span>
          {mode === "uni" && props.onNewPage
            ? actionButton("Neue Notiz in diesem Ordner", <Plus size={14} />, () => {
                open(folder.id);
                props.onNewPage!(folder.id);
              })
            : (
              <ImportPdfButton
                className="panel-item-action"
                title="PDF in diesen Ordner importieren"
                folderId={folder.id}
                onImported={(added) => {
                  open(folder.id);
                  props.onImported(added);
                }}
              >
                <Upload size={14} />
              </ImportPdfButton>
            )}
        </div>
        {isOpen && (
          <>
            {childFolders(folders, folder.id).map((child) => folderNode(child, depth + 1))}
            {mode === "uni" && pages.filter((p) => p.subjectId === folder.id).map((p) => pageRow(p, depth + 1))}
            {pdfs.filter((p) => p.folderId === folder.id).map((p) => pdfRow(p, depth + 1))}
          </>
        )}
      </div>
    );
  };

  const rootPdfs = mode === "pdfs" ? pdfs.filter((p) => !p.folderId || !folders.some((f) => f.id === p.folderId)) : [];
  return (
    <>
      {childFolders(folders, null).map((folder) => folderNode(folder, 0))}
      {rootPdfs.map((pdf) => pdfRow(pdf, 0))}
    </>
  );
}
