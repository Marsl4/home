// Alles rund um einzelne Striche: Datenformat, Aussehen, Radierer-Treffer.
import { getStroke } from "perfect-freehand";

export type Tool = "pen" | "highlighter" | "eraser" | "lasso";

export type Stroke = {
  id: string;
  tool: "pen" | "highlighter";
  color: string;
  // Punkte als [x, y, Druck]. x zählt ab dem linken Rand der Textspalte,
  // y ab dem oberen Rand der Seite (so wie die Seite beim Zeichnen aussah).
  points: [number, number, number][];
  // Der Textblock, an dem der Strich "hängt", und wo dieser Block beim Zeichnen lag.
  // Rutscht der Block später nach unten, rutscht der Strich mit.
  anchorBlockId: string | null;
  anchorTop: number;
  // true = Druck kommt vom echten Stift (Apple Pencil), sonst wird er simuliert.
  realPressure: boolean;
};

export const PEN_COLORS = ["#1f1f1f", "#2563eb", "#dc2626", "#16a34a"];
export const HIGHLIGHTER_COLORS = ["#fde047", "#86efac", "#f9a8d4"];

// Wandelt die Punkte eines Strichs in eine SVG-Form (gefüllte Kontur) um.
export function strokeToPath(stroke: Stroke): string {
  const isHighlighter = stroke.tool === "highlighter";
  const outline = getStroke(stroke.points, {
    size: isHighlighter ? 18 : 3.5,
    thinning: isHighlighter ? 0 : 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: !isHighlighter && !stroke.realPressure,
  });
  if (outline.length === 0) return "";

  const [first, ...rest] = outline;
  return `M ${first[0]} ${first[1]} ` + rest.map(([x, y]) => `L ${x} ${y}`).join(" ") + " Z";
}

// Trifft der Radierer an Position (x, y) diesen Strich? dy = aktuelle Verschiebung des Strichs.
export function hitsStroke(stroke: Stroke, x: number, y: number, dy: number, radius = 10): boolean {
  const r2 = radius * radius;
  return stroke.points.some(([px, py]) => (px - x) ** 2 + (py + dy - y) ** 2 <= r2);
}

// ---------- Lasso ----------

export type Box = { x: number; y: number; width: number; height: number };

// Liegt der Punkt innerhalb der (geschlossenen) Lasso-Linie? Klassischer "Strahl-Test".
export function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Ein Strich gilt als eingefangen, wenn mindestens die Hälfte seiner Punkte im Lasso liegt.
export function strokeInLasso(stroke: Stroke, dy: number, lasso: [number, number][]): boolean {
  const inside = stroke.points.filter(([x, y]) => pointInPolygon(x, y + dy, lasso)).length;
  return inside >= stroke.points.length / 2;
}

// Rechteck um mehrere Striche (mit etwas Rand für die Strichdicke).
export function boundsOf(strokes: { stroke: Stroke; dy: number }[], padding = 10): Box | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const { stroke, dy } of strokes) {
    for (const [x, y] of stroke.points) {
      xs.push(x);
      ys.push(y + dy);
    }
  }
  if (xs.length === 0) return null;
  const minX = Math.min(...xs) - padding;
  const minY = Math.min(...ys) - padding;
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) + padding - minX,
    height: Math.max(...ys) + padding - minY,
  };
}

// Verschiebt einen Strich um (dx, dy).
export function moveStroke(stroke: Stroke, dx: number, dy: number): Stroke {
  return { ...stroke, points: stroke.points.map(([x, y, p]) => [x + dx, y + dy, p]) };
}
