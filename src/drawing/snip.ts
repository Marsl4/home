// "Ausschnitt": einen eingekreisten Bereich als Bild (PNG) aufnehmen und in die Zwischenablage kopieren.
// Das Bild ist das Rechteck um die eingekreiste Fläche – mit allem, was dort zu sehen ist
// (Text, Zeichnungen, PDF-Inhalt).
import { toBlob } from "html-to-image";

import { showToast } from "../components/toast";
import { strokeToPath, type Box, type Stroke } from "./strokes";

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
// Für Notizseiten (Text + Zeichnungen). Für PDFs gibt es capturePdfRegion (direkter und zuverlässiger).
export async function captureRegion(element: HTMLElement, box: Box): Promise<Blob> {
  // Nicht über den Rand des Elements hinaus.
  const x = Math.max(0, Math.round(box.x));
  const y = Math.max(0, Math.round(box.y));
  const width = Math.min(element.offsetWidth - x, Math.round(box.width));
  const height = Math.min(element.offsetHeight - y, Math.round(box.height));

  const options: Parameters<typeof toBlob>[1] = {
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
  };
  // Safari lädt eingebettete Bilder beim ersten Mal oft nicht rechtzeitig mit.
  // Bekannte Abhilfe: einmal "zum Aufwärmen" erzeugen und das Ergebnis verwerfen.
  if (element.querySelector("img, canvas")) await toBlob(element, options);
  const blob = await toBlob(element, options);
  if (!blob) throw new Error("Bild konnte nicht erstellt werden");
  return blob;
}

// Ausschnitt aus einer PDF-Seite: direkt aus dem gerenderten Seitenbild ausschneiden und die
// Striche darübermalen. box, Striche und pdfWidth sind in PDF-Einheiten.
export async function capturePdfRegion(
  pageCanvas: HTMLCanvasElement,
  pdfWidth: number,
  strokes: Stroke[],
  box: Box,
): Promise<Blob> {
  const pdfHeight = (pageCanvas.height / pageCanvas.width) * pdfWidth;
  const scale = pageCanvas.width / pdfWidth; // Bildpunkte pro PDF-Einheit (scharf, inkl. Retina)

  // Nicht über den Seitenrand hinaus.
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  const width = Math.min(pdfWidth - x, box.width);
  const height = Math.min(pdfHeight - y, box.height);
  if (width <= 0 || height <= 0) throw new Error("Bereich liegt außerhalb der Seite");

  const out = document.createElement("canvas");
  out.width = Math.round(width * scale);
  out.height = Math.round(height * scale);
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);

  // 1. Das PDF-Bild (Text, Schaubilder …)
  ctx.drawImage(pageCanvas, x * scale, y * scale, width * scale, height * scale, 0, 0, out.width, out.height);

  // 2. Die eigenen Striche darüber, in denselben Koordinaten wie auf der Seite
  ctx.setTransform(scale, 0, 0, scale, -x * scale, -y * scale);
  for (const stroke of strokes) {
    const isHighlighter = stroke.tool === "highlighter";
    ctx.globalAlpha = isHighlighter ? 0.6 : 1;
    ctx.globalCompositeOperation = isHighlighter ? "multiply" : "source-over";
    ctx.fillStyle = stroke.color;
    ctx.fill(new Path2D(strokeToPath(stroke)));
  }

  return new Promise((resolve, reject) =>
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Bild konnte nicht erstellt werden"))), "image/png"),
  );
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
