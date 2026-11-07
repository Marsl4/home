// Werkzeugleiste oben rechts: Stift-Modus an/aus, Werkzeug, Farbe, Rückgängig.
import { Eraser, Highlighter, Lasso, Pencil, Scissors, Undo2, type LucideIcon } from "lucide-react";

import { HIGHLIGHTER_COLORS, PEN_COLORS, type Tool } from "./strokes";
import type { SizeLevel, ToolSettings } from "./toolSettings";

type Props = {
  penMode: boolean;
  onTogglePenMode: () => void;
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  color: string;
  onColorChange: (color: string) => void;
  canUndo: boolean;
  onUndo: () => void;
  zoom: number; // aktueller Zoom der Ansicht (1 = 100 %)
  onResetZoom: () => void;
  settings: ToolSettings; // Strichdicken + Radierer-Art
  onSettingsChange: (changes: Partial<ToolSettings>) => void;
};

const SIZE_LABELS = ["Dünn", "Mittel", "Dick"];
const LEVELS: SizeLevel[] = [0, 1, 2];

const TOOLS: { tool: Tool; label: string; icon: LucideIcon }[] = [
  { tool: "pen", label: "Stift", icon: Pencil },
  { tool: "highlighter", label: "Textmarker", icon: Highlighter },
  { tool: "eraser", label: "Radierer", icon: Eraser },
  { tool: "lasso", label: "Lasso: einkreisen, dann verschieben (⌫ löscht)", icon: Lasso },
  { tool: "snip", label: "Ausschnitt: Bereich einkreisen → als Bild kopieren", icon: Scissors },
];

export function DrawingToolbar(props: Props) {
  const { penMode, tool, color } = props;

  // Nur sichtbar, wenn gezoomt ist: Prozentzahl, antippen = zurück auf 100 %.
  const zoomButton = Math.abs(props.zoom - 1) > 0.01 && (
    <button className="toolbar-button zoom-button" onClick={props.onResetZoom} title="Zoom zurücksetzen (100 %)">
      {Math.round(props.zoom * 100)} %
    </button>
  );

  if (!penMode) {
    return (
      <div className="drawing-toolbar">
        {zoomButton}
        <button className="toolbar-button" onClick={props.onTogglePenMode} title="Zeichnen (Stift-Modus)">
          <Pencil size={16} /> Zeichnen
        </button>
      </div>
    );
  }

  const colors = tool === "highlighter" ? HIGHLIGHTER_COLORS : tool === "pen" ? PEN_COLORS : [];
  // Welche Dicke wird gerade eingestellt?
  const sizeKey =
    tool === "pen" ? "penSize" : tool === "highlighter" ? "highlighterSize" : tool === "eraser" ? "eraserSize" : null;

  // Beim Werkzeugwechsel eine passende Farbe wählen.
  const selectTool = (next: Tool) => {
    props.onToolChange(next);
    if (next === "pen" && !PEN_COLORS.includes(color)) props.onColorChange(PEN_COLORS[0]);
    if (next === "highlighter" && !HIGHLIGHTER_COLORS.includes(color)) props.onColorChange(HIGHLIGHTER_COLORS[0]);
  };

  return (
    <div className="drawing-toolbar">
      {zoomButton}
      {TOOLS.map((t) => (
        <button
          key={t.tool}
          className={`toolbar-button ${tool === t.tool ? "selected" : ""}`}
          onClick={() => selectTool(t.tool)}
          title={t.label}
        >
          <t.icon size={18} />
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

      {sizeKey && <span className="toolbar-divider" />}
      {sizeKey &&
        LEVELS.map((level) => (
          <button
            key={level}
            className={`size-button ${props.settings[sizeKey] === level ? "selected" : ""}`}
            onClick={() => props.onSettingsChange({ [sizeKey]: level })}
            title={`${tool === "eraser" ? "Radierer" : "Strich"}: ${SIZE_LABELS[level]}`}
          >
            <span className="size-dot" style={{ width: 4 + level * 4, height: 4 + level * 4 }} />
          </button>
        ))}

      {tool === "eraser" && (
        <>
          <span className="toolbar-divider" />
          <button
            className={`toolbar-button text ${props.settings.eraserMode === "stroke" ? "selected" : ""}`}
            onClick={() => props.onSettingsChange({ eraserMode: "stroke" })}
            title="Strich-Radierer: der ganze Strich verschwindet"
          >
            Strich
          </button>
          <button
            className={`toolbar-button text ${props.settings.eraserMode === "precise" ? "selected" : ""}`}
            onClick={() => props.onSettingsChange({ eraserMode: "precise" })}
            title="Präzisions-Radierer: nur der überfahrene Teil verschwindet"
          >
            Genau
          </button>
        </>
      )}

      <span className="toolbar-divider" />
      <button className="toolbar-button" onClick={props.onUndo} disabled={!props.canUndo} title="Rückgängig (⌘Z)">
        <Undo2 size={18} />
      </button>
      <button className="toolbar-button done" onClick={props.onTogglePenMode} title="Fertig (Esc)">
        Fertig
      </button>
    </div>
  );
}
