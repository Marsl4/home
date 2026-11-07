// Frei platzierbare Textfelder auf Notizseiten (wie in Goodnotes: irgendwo hintippen und schreiben).
// Sie hängen – wie Striche und Bilder – am Textblock darüber und wandern mit, wenn sich der Text verschiebt.
export type FloatingText = {
  id: string;
  text: string;
  x: number; // ab dem linken Rand der Textspalte
  y: number; // ab dem oberen Seitenrand (so wie die Seite beim Platzieren aussah)
  width: number;
  anchorBlockId: string | null;
  anchorTop: number;
};

export const DEFAULT_TEXT_WIDTH = 280;
export const MIN_TEXT_WIDTH = 80;
