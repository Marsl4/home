// Alles rund um einzelne Striche: Datenformat, Aussehen, Radierer-Treffer.
import { getStroke } from "perfect-freehand";

export type Tool = "pen" | "highlighter" | "eraser" | "lasso" | "snip"; // snip = Ausschnitt kopieren

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
  // true = automatisch begradigte Form (Linie, Rechteck, Kreis …): ohne Nachzieh-Glättung zeichnen.
  shape?: boolean;
  // Strichdicke. Fehlt sie (ältere Striche), gilt die mittlere Dicke des Werkzeugs.
  size?: number;
};

export const PEN_COLORS = ["#1f1f1f", "#2563eb", "#dc2626", "#16a34a"];
export const HIGHLIGHTER_COLORS = ["#fde047", "#86efac", "#f9a8d4"];

// Je drei Stufen: dünn, mittel (= frühere Standarddicke), dick.
export const PEN_SIZES = [2, 3.5, 6];
export const HIGHLIGHTER_SIZES = [10, 18, 28];
export const ERASER_SIZES = [5, 12, 24]; // Radius des Radierers

// Wandelt die Punkte eines Strichs in eine SVG-Form (gefüllte Kontur) um.
export function strokeToPath(stroke: Stroke): string {
  const isHighlighter = stroke.tool === "highlighter";
  const outline = getStroke(stroke.points, {
    size: stroke.size ?? (isHighlighter ? HIGHLIGHTER_SIZES[1] : PEN_SIZES[1]),
    thinning: isHighlighter || stroke.shape ? 0 : 0.6, // Formen: gleichmäßig dick, saubere Ecken
    smoothing: 0.6,
    // wenig "Nachziehen": die Linie folgt dem Stift ohne sichtbare Verzögerung
    streamline: stroke.shape ? 0 : 0.2,
    simulatePressure: !isHighlighter && !stroke.realPressure,
  });
  return outlineToPath(outline);
}

// Umriss -> SVG-Pfad mit weichen Kurven (statt vieler kurzer gerader Stücke, die eckig wirken).
// Jeder Umrisspunkt wird Kontrollpunkt einer Kurve durch die Mittelpunkte zu den Nachbarn.
function outlineToPath(outline: number[][]): string {
  if (outline.length === 0) return "";
  const r = (n: number) => Math.round(n * 100) / 100;
  if (outline.length < 4) {
    const [first, ...rest] = outline;
    return `M ${r(first[0])} ${r(first[1])} ` + rest.map(([x, y]) => `L ${r(x)} ${r(y)}`).join(" ") + " Z";
  }
  const mid = (a: number[], b: number[]) => `${r((a[0] + b[0]) / 2)} ${r((a[1] + b[1]) / 2)}`;
  let path = `M ${mid(outline[0], outline[1])}`;
  for (let i = 1; i < outline.length; i++) {
    const point = outline[i];
    const next = outline[(i + 1) % outline.length];
    path += ` Q ${r(point[0])} ${r(point[1])} ${mid(point, next)}`;
  }
  return path + " Z";
}

// Trifft der Radierer an Position (x, y) diesen Strich? dy = aktuelle Verschiebung des Strichs.
// Der Radius wächst mit der Strichdicke, damit auch dicke Striche am Rand getroffen werden.
export function hitsStroke(stroke: Stroke, x: number, y: number, dy: number, radius = 10): boolean {
  const r2 = (radius + strokeHalfWidth(stroke)) ** 2;
  return stroke.points.some(([px, py]) => (px - x) ** 2 + (py + dy - y) ** 2 <= r2);
}

function strokeHalfWidth(stroke: Stroke): number {
  return (stroke.size ?? (stroke.tool === "highlighter" ? HIGHLIGHTER_SIZES[1] : PEN_SIZES[1])) / 2;
}

// Präzisions-Radierer: nur die getroffenen Punkte entfernen. Der Strich zerfällt dabei
// in die Stücke davor und danach. null = Strich nicht getroffen.
export function eraseFromStroke(stroke: Stroke, x: number, y: number, dy: number, radius: number): Stroke[] | null {
  if (!hitsStroke(stroke, x, y, dy, radius)) return null;
  const r2 = (radius + strokeHalfWidth(stroke) * 0.5) ** 2;
  const pieces: [number, number, number][][] = [[]];
  for (const point of stroke.points) {
    const hit = (point[0] - x) ** 2 + (point[1] + dy - y) ** 2 <= r2;
    if (hit) {
      if (pieces[pieces.length - 1].length) pieces.push([]);
    } else {
      pieces[pieces.length - 1].push(point);
    }
  }
  const kept = pieces.filter((piece) => piece.length >= 2);
  // Nur ein Stück und nichts weggenommen? Dann nichts ändern (Treffer lag nur am Rand).
  if (kept.length === 1 && kept[0].length === stroke.points.length) return null;
  return kept.map((points, i) => ({ ...stroke, id: i === 0 ? stroke.id : crypto.randomUUID(), points }));
}

// Textmarker: Eine längere, ungefähr gerade Markierung wird zu einer sauberen geraden Linie
// (fast waagerecht -> ganz waagerecht, auf mittlerer Höhe). Sonst null = so lassen.
export function straightenHighlight(points: [number, number, number][]): [number, number, number][] | null {
  if (points.length < 4) return null;
  const start = points[0];
  const end = points[points.length - 1];
  const straight = Math.hypot(end[0] - start[0], end[1] - start[1]);
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  if (straight < 40 || straight / length < 0.85) return null; // kurz oder eher gekritzelt
  const pressure = 0.5;
  const angle = (Math.atan2(end[1] - start[1], end[0] - start[0]) * 180) / Math.PI;
  const nearHorizontal = Math.abs(angle) < 12 || Math.abs(Math.abs(angle) - 180) < 12;
  const from: [number, number] = [start[0], start[1]];
  const to: [number, number] = [end[0], end[1]];
  if (nearHorizontal) {
    const avgY = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    from[1] = to[1] = avgY;
  }
  const steps = Math.max(2, Math.ceil(straight / 4));
  return Array.from({ length: steps + 1 }, (_, i) => [
    from[0] + ((to[0] - from[0]) * i) / steps,
    from[1] + ((to[1] - from[1]) * i) / steps,
    pressure,
  ]);
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

// Ein Strich gilt als eingefangen, sobald irgendein Teil von ihm im Lasso liegt.
// (Das Lasso wird dafür gedanklich vom letzten zum ersten Punkt geschlossen.)
export function strokeInLasso(stroke: Stroke, dy: number, lasso: [number, number][]): boolean {
  return stroke.points.some(([x, y]) => pointInPolygon(x, y + dy, lasso));
}

// Liegt ein Rechteck (z. B. ein Bild) im Lasso? Es reicht, wenn es teilweise drin ist.
export function boxInLasso(box: Box, lasso: [number, number][]): boolean {
  const { x, y, width, height } = box;
  const probes: [number, number][] = [
    [x, y], [x + width, y], [x, y + height], [x + width, y + height], [x + width / 2, y + height / 2],
  ];
  if (probes.some(([px, py]) => pointInPolygon(px, py, lasso))) return true;
  return lasso.some(([px, py]) => px >= x && px <= x + width && py >= y && py <= y + height);
}

// Kleinstes Rechteck um mehrere Rechtecke.
export function unionBoxes(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
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
