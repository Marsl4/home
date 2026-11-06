// Welche Block-Typen der Editor kennt. Eigene Blöcke (z. B. Zeichnen) werden hier ergänzt.
import { BlockNoteSchema, defaultBlockSpecs, type Block } from "@blocknote/core";

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
  },
});

export type EditorBlock = Block<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;
