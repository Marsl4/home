// Eigener Editor-Block zum Zeichnen. Innen steckt Excalidraw.
// Die Zeichnung wird als Text (JSON) im Block selbst gespeichert, d. h. sie wird
// automatisch zusammen mit der Seite gespeichert.
import { useEffect, useRef, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { Excalidraw, getSceneVersion } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, BinaryFiles } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";

const SAVE_DELAY_MS = 400;

type StoredScene = {
  elements: unknown[];
  files: BinaryFiles;
};

function parseScene(json: string): StoredScene | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as StoredScene;
  } catch {
    return null;
  }
}

// Die eigentliche Zeichenfläche. Bekommt die gespeicherte Zeichnung und meldet Änderungen zurück.
function DrawingCanvas({ scene, onSave }: { scene: string; onSave: (scene: string) => void }) {
  // Nur beim ersten Anzeigen aus dem gespeicherten Block lesen.
  const [initialScene] = useState(() => parseScene(scene));
  const lastVersion = useRef(-1);
  const saveTimer = useRef<number | undefined>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  // Mausrad/Trackpad soll die Seite scrollen und nicht die Zeichenfläche verschieben.
  // Zoomen mit zwei Fingern (oder Strg + Mausrad) geht weiterhin.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
    };
    wrapper.addEventListener("wheel", onWheel, { capture: true });
    return () => wrapper.removeEventListener("wheel", onWheel, { capture: true });
  }, []);

  // Direkt mit dem Stift starten, damit man sofort losmalen kann.
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  useEffect(() => {
    api?.setActiveTool({ type: "freedraw" });
  }, [api]);

  const handleChange = (
    elements: Parameters<typeof getSceneVersion>[0],
    _appState: unknown,
    files: BinaryFiles,
  ) => {
    // Excalidraw meldet sehr oft "Änderungen" (z. B. Mausbewegung).
    // Wir speichern nur, wenn sich die Zeichnung wirklich verändert hat.
    const version = getSceneVersion(elements);
    if (version === lastVersion.current) return;
    const isFirstCall = lastVersion.current === -1;
    lastVersion.current = version;
    if (isFirstCall) return; // erster Aufruf = gerade geladen, nichts Neues

    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const stored: StoredScene = { elements: [...elements], files };
      onSave(JSON.stringify(stored));
    }, SAVE_DELAY_MS);
  };

  return (
    <div className="drawing-block" ref={wrapperRef} contentEditable={false}>
      <Excalidraw
        initialData={
          initialScene
            ? {
                elements: initialScene.elements as never,
                files: initialScene.files,
                scrollToContent: true,
              }
            : null
        }
        excalidrawAPI={setApi}
        onChange={handleChange}
        langCode="de-DE"
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            toggleTheme: false,
          },
        }}
      />
    </div>
  );
}

export const DrawingBlock = createReactBlockSpec(
  {
    type: "drawing",
    propSchema: {
      scene: { default: "" }, // Zeichnung als JSON-Text
    },
    content: "none", // kein Text im Block, nur die Zeichenfläche
  },
  {
    render: ({ block, editor }) => (
      <DrawingCanvas
        scene={block.props.scene}
        onSave={(scene) => editor.updateBlock(block.id, { props: { scene } })}
      />
    ),
  },
);
