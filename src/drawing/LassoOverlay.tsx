// Zeichnet die Lasso-Linie (während des Ziehens), den Rahmen um die Auswahl
// und einen kleinen Löschen-Knopf daran (wichtig fürs iPad, dort gibt es keine ⌫-Taste).
import type { Box } from "./strokes";

type Props = {
  lasso: [number, number][] | null;
  box: Box | null;
  onDelete: () => void;
  scale?: number; // Größe des Knopfs anpassen (PDF-Einheiten sind kleiner als Pixel)
};

export function LassoOverlay({ lasso, box, onDelete, scale = 1 }: Props) {
  return (
    <>
      {lasso && lasso.length > 1 && (
        <polygon className="lasso-line" points={lasso.map(([x, y]) => `${x},${y}`).join(" ")} />
      )}
      {box && (
        <rect
          className="lasso-box"
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          rx={6}
        />
      )}
      {box && (
        <g
          className="lasso-delete"
          transform={`translate(${box.x + box.width} ${box.y}) scale(${scale})`}
          onPointerDown={(event) => {
            event.stopPropagation(); // nicht gleichzeitig ein neues Lasso beginnen
            onDelete();
          }}
        >
          <title>Auswahl löschen</title>
          <circle r={11} />
          <path d="M -4 -4 L 4 4 M 4 -4 L -4 4" />
        </g>
      )}
    </>
  );
}
