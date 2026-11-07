// Frei platzierbare Bilder auf Notizseiten (z. B. eingefügte Ausschnitte).
// Sie hängen – wie Striche – am Textblock darüber und wandern mit, wenn sich der Text verschiebt.

export type FloatingImage = {
  id: string;
  src: string; // Bild als "data URL" (wird mit der Seite gespeichert)
  // Position wie bei Strichen: x ab dem linken Rand der Textspalte, y ab dem oberen Seitenrand
  // (so wie die Seite beim Platzieren aussah).
  x: number;
  y: number;
  width: number; // angezeigte Größe in Pixeln
  height: number;
  anchorBlockId: string | null;
  anchorTop: number;
};

export const MIN_IMAGE_WIDTH = 40;
const MAX_INITIAL_WIDTH = 600;

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Anfangsgröße eines neuen Bildes: Ausschnitte sind hochaufgelöst (2–4 Bildpunkte pro Pixel),
// darum halbe Originalbreite, aber höchstens MAX_INITIAL_WIDTH.
export async function initialImageSize(src: string): Promise<{ width: number; height: number }> {
  const image = new Image();
  image.src = src;
  await image.decode();
  const width = Math.min(image.naturalWidth / 2, MAX_INITIAL_WIDTH);
  return { width, height: (width * image.naturalHeight) / image.naturalWidth };
}
