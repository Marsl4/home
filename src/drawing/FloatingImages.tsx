// Zeigt die frei platzierten Bilder einer Notizseite als Boxen:
// anklicken = auswählen, ziehen = verschieben, Ecke unten rechts = Größe ändern, × oder ⌫ = löschen.
import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { MIN_IMAGE_WIDTH, type FloatingImage } from "./images";

type Props = {
  images: FloatingImage[];
  columnLeft: number; // Abstand der Textspalte vom linken Rand
  offsetOf: (image: FloatingImage) => number; // Verschiebung, weil der Text darüber gewandert ist
  interactive: boolean; // im Stift-Modus nicht anfassbar (dann wird darüber gezeichnet)
  onMove: (id: string, dx: number, dy: number) => void;
  onResize: (id: string, width: number, height: number) => void;
  onDelete: (id: string) => void;
};

type Drag = { id: string; mode: "move" | "resize"; startX: number; startY: number; dx: number; dy: number };

export function FloatingImages(props: Props) {
  const { images, columnLeft, offsetOf, interactive } = props;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  // Klick irgendwo anders hebt die Auswahl auf.
  useEffect(() => {
    if (!selectedId) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest(".floating-image")) setSelectedId(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [selectedId]);

  const startDrag = (event: React.PointerEvent, id: string, mode: Drag["mode"]) => {
    event.stopPropagation();
    event.preventDefault(); // kein Text markieren / Bild-Ziehen des Browsers
    const element = event.currentTarget as HTMLElement;
    element.setPointerCapture(event.pointerId);
    // Fokus auf die Box, damit ⌫ zum Löschen bei ihr ankommt.
    element.closest<HTMLElement>(".floating-image")?.focus({ preventScroll: true });
    setSelectedId(id);
    setDrag({ id, mode, startX: event.clientX, startY: event.clientY, dx: 0, dy: 0 });
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, dx: event.clientX - drag.startX, dy: event.clientY - drag.startY });
  };

  // Größe während des Ziehens an der Ecke (Seitenverhältnis bleibt gleich).
  const resizedWidth = (image: FloatingImage) =>
    Math.max(MIN_IMAGE_WIDTH, image.width + (drag?.id === image.id && drag.mode === "resize" ? drag.dx : 0));

  const onPointerUp = (event: React.PointerEvent, image: FloatingImage) => {
    if (!drag) return;
    setDrag(null);
    // Endposition direkt vom Loslassen nehmen (die letzte Bewegung ist evtl. noch nicht im Zustand).
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (dx === 0 && dy === 0) return; // nur angeklickt
    if (drag.mode === "move") {
      props.onMove(image.id, dx, dy);
    } else {
      const width = Math.max(MIN_IMAGE_WIDTH, image.width + dx);
      props.onResize(image.id, width, (width * image.height) / image.width);
    }
  };

  const remove = (id: string) => {
    setSelectedId(null);
    props.onDelete(id);
  };

  return (
    <div className="floating-images">
      {images.map((image) => {
        const isDragged = drag?.id === image.id;
        const moveX = isDragged && drag.mode === "move" ? drag.dx : 0;
        const moveY = isDragged && drag.mode === "move" ? drag.dy : 0;
        const width = resizedWidth(image);
        return (
          <div
            key={image.id}
            className={`floating-image ${selectedId === image.id ? "selected" : ""} ${interactive ? "interactive" : ""}`}
            style={{
              left: columnLeft + image.x + moveX,
              top: image.y + offsetOf(image) + moveY,
              width,
              height: (width * image.height) / image.width,
            }}
            tabIndex={interactive ? 0 : -1}
            onPointerDown={(e) => startDrag(e, image.id, "move")}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => onPointerUp(e, image)}
            onPointerCancel={() => setDrag(null)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" || e.key === "Delete") {
                e.preventDefault();
                remove(image.id);
              }
            }}
          >
            <img src={image.src} alt="" draggable={false} />
            {selectedId === image.id && interactive && (
              <>
                <button
                  className="floating-image-delete"
                  title="Bild löschen"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => remove(image.id)}
                >
                  <X size={14} />
                </button>
                <div
                  className="floating-image-resize"
                  title="Größe ändern"
                  onPointerDown={(e) => startDrag(e, image.id, "resize")}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
