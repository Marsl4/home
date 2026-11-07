// Zeigt die frei platzierten Textfelder einer Notizseite.
// Griff oben links = verschieben, rechter Rand = Breite ändern, × = löschen.
// Ein leeres Textfeld verschwindet von selbst, sobald man es verlässt.
import { useEffect, useRef, useState } from "react";
import { GripVertical, X } from "lucide-react";

import { MIN_TEXT_WIDTH, type FloatingText } from "./texts";

type Props = {
  texts: FloatingText[];
  columnLeft: number;
  zoom: number;
  offsetOf: (text: FloatingText) => number;
  interactive: boolean; // anfassbar (sonst wird darüber gezeichnet)
  lassoSelected: Set<string>;
  lassoOffset: { dx: number; dy: number };
  onChange: (id: string, text: string) => void;
  onMove: (id: string, dx: number, dy: number) => void;
  onResize: (id: string, width: number) => void;
  onDelete: (id: string) => void;
  onMeasure: (id: string, height: number) => void; // Höhe melden (fürs Lasso)
};

type Drag = { id: string; mode: "move" | "resize"; startX: number; startY: number; dx: number; dy: number };

export function FloatingTexts(props: Props) {
  const { texts, columnLeft, zoom, offsetOf, interactive } = props;
  const [drag, setDrag] = useState<Drag | null>(null);

  const startDrag = (event: React.PointerEvent, id: string, mode: Drag["mode"]) => {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ id, mode, startX: event.clientX, startY: event.clientY, dx: 0, dy: 0 });
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, dx: (event.clientX - drag.startX) / zoom, dy: (event.clientY - drag.startY) / zoom });
  };
  const onPointerUp = (event: React.PointerEvent, text: FloatingText) => {
    if (!drag) return;
    setDrag(null);
    const dx = (event.clientX - drag.startX) / zoom;
    const dy = (event.clientY - drag.startY) / zoom;
    if (dx === 0 && dy === 0) return;
    if (drag.mode === "move") props.onMove(text.id, dx, dy);
    else props.onResize(text.id, Math.max(MIN_TEXT_WIDTH, text.width + dx));
  };

  return (
    <div className="floating-texts">
      {texts.map((text) => {
        const isDragged = drag?.id === text.id;
        const inLasso = props.lassoSelected.has(text.id);
        const moveX = (isDragged && drag.mode === "move" ? drag.dx : 0) + (inLasso ? props.lassoOffset.dx : 0);
        const moveY = (isDragged && drag.mode === "move" ? drag.dy : 0) + (inLasso ? props.lassoOffset.dy : 0);
        const width = Math.max(MIN_TEXT_WIDTH, text.width + (isDragged && drag.mode === "resize" ? drag.dx : 0));
        return (
          <div
            key={text.id}
            className={`floating-text ${interactive ? "interactive" : ""} ${inLasso ? "selected" : ""}`}
            style={{ left: columnLeft + text.x + moveX, top: text.y + offsetOf(text) + moveY, width }}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => onPointerUp(e, text)}
            onPointerCancel={() => setDrag(null)}
          >
            <div className="floating-text-grip" title="Verschieben" onPointerDown={(e) => startDrag(e, text.id, "move")}>
              <GripVertical size={14} />
            </div>
            <TextArea text={text} onChange={props.onChange} onDelete={props.onDelete} onMeasure={props.onMeasure} />
            <button
              className="floating-text-delete"
              title="Textfeld löschen"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => props.onDelete(text.id)}
            >
              <X size={12} />
            </button>
            <div
              className="floating-text-resize"
              title="Breite ändern"
              onPointerDown={(e) => startDrag(e, text.id, "resize")}
            />
          </div>
        );
      })}
    </div>
  );
}

// Eingabefeld, das mit dem Text in der Höhe wächst.
function TextArea({
  text,
  onChange,
  onDelete,
  onMeasure,
}: {
  text: FloatingText;
  onChange: Props["onChange"];
  onDelete: Props["onDelete"];
  onMeasure: Props["onMeasure"];
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const area = ref.current!;
    area.style.height = "auto";
    area.style.height = `${area.scrollHeight}px`;
    onMeasure(text.id, area.offsetHeight);
  });
  return (
    <textarea
      ref={ref}
      className="floating-text-input"
      data-text-id={text.id}
      value={text.text}
      rows={1}
      placeholder="Text …"
      spellCheck
      lang="de"
      onChange={(e) => onChange(text.id, e.target.value)}
      onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
      onBlur={() => !text.text.trim() && onDelete(text.id)}
    />
  );
}
