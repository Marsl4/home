import { useEffect, useRef } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { de } from "@blocknote/core/locales";
import "@blocknote/mantine/style.css";

import { schema, type EditorBlock } from "../../editor/schema";
import { savePageContent } from "../../storage/db";
import { hasOtherViewers, publish, useLiveSync } from "../../storage/liveSync";

type Props = {
  pageId: string;
  initialContent: EditorBlock[] | undefined;
};

const SAVE_DELAY_MS = 500;
const SYNC_DELAY_MS = 150; // Abgleich mit der zweiten Hälfte, wenn dieselbe Seite zweimal offen ist

// Wandelt eine Datei in einen Text ("data URL") um, der mit der Seite gespeichert wird.
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Sieht der Text nach Markdown aus? (mindestens zwei Zeilen mit #-Überschrift, Aufzählung, Nummerierung …)
function looksLikeMarkdown(text: string): boolean {
  const markdownLines = text.split("\n").filter((line) => /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s)/.test(line));
  return markdownLines.length >= 2 || /\*\*[^*]+\*\*/.test(text);
}

// Bringt die Quelle schon echte Formatierung mit (Überschriften, Listen, Fett)? Dann die nehmen.
function hasFormatting(html: string): boolean {
  return /<(h[1-6]|ul|ol|li|table|strong|b|em)[\s>]/i.test(html);
}

// Kleine Aufbereitung: Unterstreichungen <u>…</u> als HTML behalten, kaputte Bild-Verweise aus
// Notion-Exporten ("!image.png") als Hinweis kennzeichnen.
function prepareMarkdown(text: string): string {
  return text.replace(/^(\s*)!([^\s[\]]+\.(png|jpe?g|gif|webp))\s*$/gim, "$1*(Bild: $2)*");
}

// Der Editor für EINE Seite. Beim Seitenwechsel wird er neu erzeugt (siehe key in App.tsx).
export function PageEditor({ pageId, initialContent }: Props) {
  const editor = useCreateBlockNote({
    schema,
    dictionary: de, // Menüs auf Deutsch
    uploadFile: fileToDataUrl, // Bilder/Dateien direkt in der Seite speichern (kein Server nötig)
    // BlockNote mag keine leere Liste, deshalb "undefined" = leere Seite.
    initialContent: initialContent?.length ? initialContent : undefined,
    // Eingefügter Markdown-Text (z. B. aus Notion, ChatGPT, Gemini) wird mit Überschriften,
    // Aufzählungen und Fett-/Unterstrichen übernommen – auch wenn die Quelle ihn zusätzlich als
    // einfachen Block (ohne Formatierung) mitschickt.
    pasteHandler: ({ event, editor, defaultPasteHandler }) => {
      const text = event.clipboardData?.getData("text/plain") ?? "";
      const html = event.clipboardData?.getData("text/html") ?? "";
      if (looksLikeMarkdown(text) && !hasFormatting(html)) {
        editor.pasteMarkdown(prepareMarkdown(text));
        return true;
      }
      return defaultPasteHandler();
    },
  });

  // Live-Abgleich: Ist dieselbe Seite im Split-Modus zweimal offen, übernimmt die andere Hälfte
  // Änderungen sofort. "applyingRemote" verhindert, dass die Übernahme wieder zurückgeschickt wird.
  const syncKey = `page-content:${pageId}`;
  const applyingRemote = useRef(false);
  const syncTimer = useRef<number | undefined>(undefined);
  const syncId = useLiveSync<EditorBlock[]>(syncKey, (blocks) => {
    applyingRemote.current = true;
    editor.replaceBlocks(editor.document, blocks);
    applyingRemote.current = false;
  });

  // Automatisch speichern: erst wenn 0,5 s lang nichts geändert wurde (spart Arbeit beim Tippen).
  const saveTimer = useRef<number | undefined>(undefined);

  const scheduleSave = () => {
    if (applyingRemote.current) return; // kam von der anderen Hälfte, die speichert selbst
    if (hasOtherViewers(syncKey)) {
      window.clearTimeout(syncTimer.current);
      syncTimer.current = window.setTimeout(() => publish(syncKey, syncId, editor.document), SYNC_DELAY_MS);
    }
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
      window.clearTimeout(syncTimer.current);
      flush();
    };
  }, [editor, pageId]);

  return <BlockNoteView editor={editor} onChange={scheduleSave} theme="light" />;
}
