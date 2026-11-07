// "Ausschnitt": einen eingekreisten Bereich als Bild (PNG) aufnehmen und in die Zwischenablage kopieren.
// Das Bild ist das Rechteck um die eingekreiste Fläche – mit allem, was dort zu sehen ist
// (Text, Zeichnungen, PDF-Inhalt).
import { toBlob } from "html-to-image";

import { showToast } from "../components/toast";
import type { Box } from "./strokes";

// Diese Elemente sollen nicht mit aufs Bild (Werkzeugleiste, Lasso-Linie, Rahmen …).
const SKIP_CLASSES = ["drawing-toolbar", "lasso-line", "lasso-box", "lasso-delete", "bn-side-menu"];

// Rechteck um die eingekreiste Linie.
export function boundsOfPolygon(points: [number, number][], padding = 4): Box {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const x = Math.min(...xs) - padding;
  const y = Math.min(...ys) - padding;
  return { x, y, width: Math.max(...xs) + padding - x, height: Math.max(...ys) + padding - y };
}

// Nimmt den Bereich "box" (in Pixeln, relativ zur linken oberen Ecke von "element") als Bild auf.
export async function captureRegion(element: HTMLElement, box: Box): Promise<Blob> {
  // Nicht über den Rand des Elements hinaus.
  const x = Math.max(0, Math.round(box.x));
  const y = Math.max(0, Math.round(box.y));
  const width = Math.min(element.offsetWidth - x, Math.round(box.width));
  const height = Math.min(element.offsetHeight - y, Math.round(box.height));

  const blob = await toBlob(element, {
    width,
    height,
    pixelRatio: 2, // scharf auch auf Retina-Bildschirmen
    backgroundColor: "#ffffff",
    skipFonts: true, // die App nutzt Systemschriften, die muss man nicht einbetten
    // Trick zum Zuschneiden: das ganze Element so verschieben, dass nur der gewünschte Bereich ins Bild passt.
    style: {
      width: `${element.offsetWidth}px`,
      height: `${element.offsetHeight}px`,
      margin: "0",
      transform: `translate(${-x}px, ${-y}px)`,
      transformOrigin: "0 0",
    },
    filter: (node) => !SKIP_CLASSES.some((name) => node.classList?.contains(name)),
  });
  if (!blob) throw new Error("Bild konnte nicht erstellt werden");
  return blob;
}

// Kopiert das Bild in die Zwischenablage und zeigt eine Meldung.
// WICHTIG: muss direkt beim Loslassen des Stifts aufgerufen werden (Safari erlaubt Kopieren
// nur unmittelbar nach einer Nutzer-Aktion) – deshalb wird das noch entstehende Bild übergeben.
export function copySnipToClipboard(image: Promise<Blob>) {
  navigator.clipboard
    .write([new ClipboardItem({ "image/png": image })])
    .then(() => showToast("Ausschnitt kopiert – mit ⌘V einfügen"))
    .catch(async () => {
      // Falls Kopieren nicht erlaubt ist: Bild stattdessen zum Speichern anbieten.
      try {
        const blob = await image;
        showToast("Kopieren nicht möglich.", {
          label: "Als Bild speichern",
          onClick: () => downloadImage(blob),
        });
      } catch {
        showToast("Ausschnitt konnte nicht erstellt werden.");
      }
    });
}

function downloadImage(blob: Blob) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `ausschnitt-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
  link.click();
  URL.revokeObjectURL(link.href);
}
