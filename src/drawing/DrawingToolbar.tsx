// Werkzeugleiste oben rechts: Stift-Modus an/aus, Werkzeug, Farbe, Rückgängig.
import { HIGHLIGHTER_COLORS, PEN_COLORS, type Tool } from "./strokes";

type Props = {
  penMode: boolean;
  onTogglePenMode: () => void;
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  color: string;
  onColorChange: (color: string) => void;
  canUndo: boolean;
  onUndo: () => void;
};

const TOOLS: { tool: Tool; label: string; icon: string }[] = [
  { tool: "pen", label: "Stift", icon: "✏️" },
  { tool: "highlighter", label: "Textmarker", icon: "🖍️" },
  { tool: "eraser", label: "Radierer", icon: "🧽" },
];

export function DrawingToolbar(props: Props) {
  const { penMode, tool, color } = props;

  if (!penMode) {
    return (
      <div className="drawing-toolbar">
        <button className="toolbar-button" onClick={props.onTogglePenMode} title="Zeichnen (Stift-Modus)">
          ✏️ Zeichnen
        </button>
      </div>
    );
  }

  const colors = tool === "highlighter" ? HIGHLIGHTER_COLORS : tool === "pen" ? PEN_COLORS : [];

  // Beim Werkzeugwechsel eine passende Farbe wählen.
  const selectTool = (next: Tool) => {
    props.onToolChange(next);
    if (next === "pen" && !PEN_COLORS.includes(color)) props.onColorChange(PEN_COLORS[0]);
    if (next === "highlighter" && !HIGHLIGHTER_COLORS.includes(color)) props.onColorChange(HIGHLIGHTER_COLORS[0]);
  };

  return (
    <div className="drawing-toolbar">
      {TOOLS.map((t) => (
        <button
          key={t.tool}
          className={`toolbar-button ${tool === t.tool ? "selected" : ""}`}
          onClick={() => selectTool(t.tool)}
          title={t.label}
        >
          {t.icon}
        </button>
      ))}

      {colors.length > 0 && <span className="toolbar-divider" />}
      {colors.map((c) => (
        <button
          key={c}
          className={`color-swatch ${color === c ? "selected" : ""}`}
          style={{ background: c }}
          onClick={() => props.onColorChange(c)}
          title="Farbe"
        />
      ))}

      <span className="toolbar-divider" />
      <button className="toolbar-button" onClick={props.onUndo} disabled={!props.canUndo} title="Rückgängig (⌘Z)">
        ↶
      </button>
      <button className="toolbar-button done" onClick={props.onTogglePenMode} title="Fertig (Esc)">
        Fertig
      </button>
    </div>
  );
}
