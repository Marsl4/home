// Gewählte Strichdicken und Radierer-Art – gelten für Notizen und PDFs und bleiben gespeichert.
import { usePersistentState } from "../storage/uiState";
import { ERASER_SIZES, HIGHLIGHTER_SIZES, PEN_SIZES } from "./strokes";

export type EraserMode = "stroke" | "precise"; // ganzer Strich / nur der überfahrene Teil
export type SizeLevel = 0 | 1 | 2; // dünn, mittel, dick

export type ToolSettings = {
  penSize: SizeLevel;
  highlighterSize: SizeLevel;
  eraserSize: SizeLevel;
  eraserMode: EraserMode;
};

const DEFAULTS: ToolSettings = { penSize: 1, highlighterSize: 1, eraserSize: 1, eraserMode: "stroke" };

export function useToolSettings() {
  const [stored, setSettings] = usePersistentState<Partial<ToolSettings>>("ui:toolSettings", DEFAULTS);
  const settings = { ...DEFAULTS, ...stored };
  const update = (changes: Partial<ToolSettings>) => setSettings({ ...settings, ...changes });
  return { settings, update };
}

// Dicke für einen neuen Strich mit diesem Werkzeug.
export function strokeSize(tool: "pen" | "highlighter", settings: ToolSettings): number {
  return tool === "pen" ? PEN_SIZES[settings.penSize] : HIGHLIGHTER_SIZES[settings.highlighterSize];
}

export function eraserRadius(settings: ToolSettings): number {
  return ERASER_SIZES[settings.eraserSize];
}
