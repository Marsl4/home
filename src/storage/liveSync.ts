// Live-Abgleich zwischen zwei Ansichten desselben Inhalts (z. B. dieselbe Seite links UND rechts
// im Split-Modus). Wenn eine Ansicht etwas ändert, bekommen die anderen sofort den neuen Stand.
// Ohne das würde die eine Ansicht beim Speichern die Änderungen der anderen überschreiben.
import { useEffect, useRef, useState } from "react";

type Listener = (value: unknown, sourceId: string) => void;

const channels = new Map<string, Set<Listener>>();

// Neuen Stand an alle ANDEREN Ansichten mit demselben Schlüssel schicken.
export function publish(key: string, sourceId: string, value: unknown) {
  channels.get(key)?.forEach((listener) => listener(value, sourceId));
}

// Gibt es außer mir noch jemanden, der diesen Inhalt anzeigt?
export function hasOtherViewers(key: string): boolean {
  return (channels.get(key)?.size ?? 0) > 1;
}

// Auf Änderungen anderer Ansichten hören. Gibt die eigene ID zurück (für publish).
export function useLiveSync<T>(key: string, onRemoteChange: (value: T) => void): string {
  const [id] = useState(() => crypto.randomUUID());
  const callback = useRef(onRemoteChange);
  useEffect(() => {
    callback.current = onRemoteChange;
  });

  useEffect(() => {
    const listener: Listener = (value, sourceId) => {
      if (sourceId !== id) callback.current(value as T);
    };
    const listeners = channels.get(key) ?? new Set();
    listeners.add(listener);
    channels.set(key, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) channels.delete(key);
    };
  }, [key, id]);

  return id;
}
