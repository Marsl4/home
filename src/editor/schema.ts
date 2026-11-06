// Welche Block-Typen der Editor kennt. Eigene Blöcke werden hier ergänzt.
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

// Entfernt Blöcke, deren Typ der Editor nicht (mehr) kennt, z. B. den alten Zeichen-Block.
// Sonst würde das Laden einer solchen Seite fehlschlagen.
const knownTypes = new Set(Object.keys(schema.blockSchema));

export function removeUnknownBlocks(blocks: EditorBlock[]): EditorBlock[] {
  return blocks
    .filter((block) => knownTypes.has(block.type))
    .map((block) => ({ ...block, children: removeUnknownBlocks(block.children ?? []) }));
}
