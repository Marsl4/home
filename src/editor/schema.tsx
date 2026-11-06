// Welche Block-Typen der Editor kennt, und was im "/"-Menü steht.
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  insertOrUpdateBlockForSlashMenu,
  type Block,
} from "@blocknote/core";
import type { DefaultReactSuggestionItem } from "@blocknote/react";

import { DrawingBlock } from "./DrawingBlock";

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    drawing: DrawingBlock(),
  },
});

export type EditorBlock = Block<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

type Editor = typeof schema.BlockNoteEditor;

// Eintrag für das "/"-Menü, um einen Zeichen-Block einzufügen.
export function drawingSlashMenuItem(editor: Editor): DefaultReactSuggestionItem {
  return {
    title: "Zeichnung",
    subtext: "Fläche zum Zeichnen mit Maus, Trackpad oder Stift",
    aliases: ["zeichnen", "drawing", "skizze", "stift", "draw", "pencil"],
    group: "Andere",
    icon: <span style={{ fontSize: 18 }}>✏️</span>,
    onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "drawing" }),
  };
}
