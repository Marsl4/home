import { useEffect, useRef } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { de } from "@blocknote/core/locales";
import "@blocknote/mantine/style.css";

import { schema, type EditorBlock } from "../editor/schema";
import { savePageContent } from "../storage/db";

type Props = {
  pageId: string;
  initialContent: EditorBlock[] | undefined;
};

const SAVE_DELAY_MS = 500;

// Wandelt eine Datei in einen Text ("data URL") um, der mit der Seite gespeichert wird.
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Der Editor für EINE Seite. Beim Seitenwechsel wird er neu erzeugt (siehe key in App.tsx).
export function PageEditor({ pageId, initialContent }: Props) {
  const editor = useCreateBlockNote({
    schema,
    dictionary: de, // Menüs auf Deutsch
    uploadFile: fileToDataUrl, // Bilder/Dateien direkt in der Seite speichern (kein Server nötig)
    // BlockNote mag keine leere Liste, deshalb "undefined" = leere Seite.
    initialContent: initialContent?.length ? initialContent : undefined,
  });

  // Automatisch speichern: erst wenn 0,5 s lang nichts geändert wurde (spart Arbeit beim Tippen).
  const saveTimer = useRef<number | undefined>(undefined);

  const scheduleSave = () => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = undefined;
      savePageContent(pageId, editor.document);
    }, SAVE_DELAY_MS);
  };

  // Beim Verlassen der Seite (oder Schließen des Tabs) noch ausstehende Änderungen sofort speichern.
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current === undefined) return;
      window.clearTimeout(saveTimer.current);
      saveTimer.current = undefined;
      savePageContent(pageId, editor.document);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [editor, pageId]);

  return <BlockNoteView editor={editor} onChange={scheduleSave} theme="light" />;
}
