// Formerkennung: Wer beim Zeichnen am Ende kurz stillhält, bekommt aus der gezeichneten Linie
// eine saubere Form – gerade Linie, Kreis/Ellipse, Dreieck, Rechteck oder Vieleck.
// Erkennt nichts davon, bleibt die Linie, wie sie ist.
type Point = [number, number];
type StrokePoint = [number, number, number]; // x, y, Druck

export type ShapeKind = "line" | "ellipse" | "triangle" | "rectangle" | "polygon";

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function pathLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += dist(points[i - 1], points[i]);
  return length;
}

// Abstand eines Punkts von der Geraden durch a und b.
function distanceToLine(p: Point, a: Point, b: Point): number {
  const length = dist(a, b);
  if (length === 0) return dist(p, a);
  return Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / length;
}

// Ramer-Douglas-Peucker: vereinfacht eine Linie auf ihre "Ecken".
function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distanceToLine(points[i], points[0], points[points.length - 1]);
    if (d > maxDistance) {
      maxDistance = d;
      index = i;
    }
  }
  if (maxDistance <= tolerance) return [points[0], points[points.length - 1]];
  const left = simplify(points.slice(0, index + 1), tolerance);
  const right = simplify(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

// Innenwinkel-Abweichung von "gerade weiter" in Grad (0 = keine Ecke).
function turnAngle(prev: Point, corner: Point, next: Point): number {
  const a1 = Math.atan2(corner[1] - prev[1], corner[0] - prev[0]);
  const a2 = Math.atan2(next[1] - corner[1], next[0] - corner[0]);
  let diff = Math.abs(a2 - a1) * (180 / Math.PI);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

// Punkte gleichmäßig entlang gerader Kanten verteilen (für einen gleichmäßigen Strich).
function sampleEdges(corners: Point[], closed: boolean, step: number): Point[] {
  const all = closed ? [...corners, corners[0]] : corners;
  const result: Point[] = [];
  for (let i = 0; i < all.length - 1; i++) {
    const [a, b] = [all[i], all[i + 1]];
    const n = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let k = 0; k < n; k++) result.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  result.push(all[all.length - 1]);
  return result;
}

// Ist ein Winkel (in Grad) fast waagerecht oder senkrecht? Dann genau dahin einrasten.
function snapAngle(a: Point, b: Point, degrees = 5): Point {
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * (180 / Math.PI);
  const nearest = Math.round(angle / 90) * 90;
  if (Math.abs(angle - nearest) > degrees) return b;
  const length = dist(a, b);
  const rad = (nearest * Math.PI) / 180;
  return [a[0] + Math.cos(rad) * length, a[1] + Math.sin(rad) * length];
}

export function recognizeShape(input: StrokePoint[]): { kind: ShapeKind; points: StrokePoint[] } | null {
  if (input.length < 5) return null;
  const points: Point[] = input.map(([x, y]) => [x, y]);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  const size = Math.max(width, height);
  if (size < 8) return null; // zu klein (ein Punkt oder Häkchen)

  const pressure = input.reduce((sum, p) => sum + p[2], 0) / input.length;
  const step = Math.max(1, size / 80);
  const withPressure = (list: Point[]): StrokePoint[] => list.map(([x, y]) => [x, y, pressure]);
  const start = points[0];
  const end = points[points.length - 1];
  const length = pathLength(points);
  const closed = dist(start, end) < Math.max(0.25 * size, 0.12 * length);

  // ---------- Gerade Linie ----------
  if (!closed) {
    const straight = dist(start, end);
    const maxDeviation = Math.max(...points.map((p) => distanceToLine(p, start, end)));
    if (straight / length > 0.9 && maxDeviation < 0.08 * straight) {
      return { kind: "line", points: withPressure(sampleEdges([start, snapAngle(start, end)], false, step)) };
    }
    return null; // offene, gebogene Linie: so lassen
  }

  // ---------- Kreis / Ellipse ----------
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  let rx = width / 2;
  let ry = height / 2;
  if (rx > 0 && ry > 0) {
    const error =
      points.reduce((sum, [x, y]) => sum + Math.abs(Math.hypot((x - cx) / rx, (y - cy) / ry) - 1), 0) / points.length;
    if (error < 0.09) {
      if (Math.max(rx, ry) / Math.min(rx, ry) < 1.2) rx = ry = (rx + ry) / 2; // fast rund -> Kreis
      const steps = Math.max(48, Math.ceil((2 * Math.PI * Math.max(rx, ry)) / step));
      // am Startpunkt der Zeichnung beginnen, damit der Strich dort anfängt
      const startAngle = Math.atan2((start[1] - cy) / ry, (start[0] - cx) / rx);
      const ellipse: Point[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = startAngle + (i / steps) * 2 * Math.PI;
        ellipse.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
      }
      return { kind: "ellipse", points: withPressure(ellipse) };
    }
  }

  // ---------- Vielecke (Dreieck, Rechteck, …) ----------
  // Über den Startpunkt hinaus gezeichnet? Dort abschneiden, wo das Ende dem Anfang am nächsten kommt.
  let cut = points.length - 1;
  for (let i = Math.floor(points.length * 0.7); i < points.length; i++) {
    if (dist(points[i], start) < dist(points[cut], start)) cut = i;
  }
  const loop = [...points.slice(0, cut), start]; // Ende auf den Anfang legen
  let corners = simplify(loop, 0.07 * size).slice(0, -1);
  // Ecken entfernen, an denen die Linie fast gerade weiterläuft (z. B. der Startpunkt mitten auf einer Seite).
  let changed = true;
  while (changed && corners.length > 3) {
    changed = false;
    for (let i = 0; i < corners.length; i++) {
      const prev = corners[(i - 1 + corners.length) % corners.length];
      const next = corners[(i + 1) % corners.length];
      if (turnAngle(prev, corners[i], next) < 25) {
        corners = corners.filter((_, k) => k !== i);
        changed = true;
        break;
      }
    }
  }
  if (corners.length < 3 || corners.length > 8) return null;

  // Passt die Form gut zur Zeichnung? (Sonst lieber nichts ändern.)
  const edgeDistance = (p: Point) =>
    Math.min(...corners.map((c, i) => segmentDistance(p, c, corners[(i + 1) % corners.length])));
  const fit = points.reduce((sum, p) => sum + edgeDistance(p), 0) / points.length;
  if (fit > 0.06 * size) return null;

  if (corners.length === 4) {
    const rightAngles = corners.every((c, i) => {
      const turn = turnAngle(corners[(i + 3) % 4], c, corners[(i + 1) % 4]);
      return Math.abs(turn - 90) < 20;
    });
    const axisAligned = corners.every((c, i) => {
      const next = corners[(i + 1) % 4];
      const angle = (Math.atan2(next[1] - c[1], next[0] - c[0]) * 180) / Math.PI;
      return Math.abs(angle - Math.round(angle / 90) * 90) < 12;
    });
    if (rightAngles && axisAligned) {
      // Rechteck genau waagerecht/senkrecht
      const left = Math.min(...corners.map((c) => c[0]));
      const right = Math.max(...corners.map((c) => c[0]));
      const top = Math.min(...corners.map((c) => c[1]));
      const bottom = Math.max(...corners.map((c) => c[1]));
      const rect: Point[] = [[left, top], [right, top], [right, bottom], [left, bottom]];
      // im Eck beginnen, das dem Startpunkt am nächsten liegt
      const first = rect.reduce((best, c, i) => (dist(c, start) < dist(rect[best], start) ? i : best), 0);
      const ordered = [...rect.slice(first), ...rect.slice(0, first)];
      return { kind: "rectangle", points: withPressure(sampleEdges(ordered, true, step)) };
    }
  }

  const kind: ShapeKind = corners.length === 3 ? "triangle" : corners.length === 4 ? "rectangle" : "polygon";
  return { kind, points: withPressure(sampleEdges(corners, true, step)) };
}

function segmentDistance(p: Point, a: Point, b: Point): number {
  const lengthSquared = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  if (lengthSquared === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / lengthSquared));
  return dist(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
}
