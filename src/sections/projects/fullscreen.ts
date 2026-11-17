// Echtes Vollbild des Browsers (wo vorhanden), z. B. für die Präsentation.
// Muss direkt beim Klick aufgerufen werden (Browser erlauben Vollbild nur als Folge einer Eingabe).
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FullscreenDocument = Document & { webkitExitFullscreen?: () => void; webkitFullscreenElement?: Element | null };

export function enterFullscreen() {
  const element = document.documentElement as FullscreenElement;
  try {
    const result = element.requestFullscreen ? element.requestFullscreen() : element.webkitRequestFullscreen?.();
    // Klappt es nicht (z. B. in der installierten iPad-App), reicht die Abdeckung des ganzen Fensters.
    if (result instanceof Promise) result.catch(() => {});
  } catch {
    // ebenso
  }
}

export function isFullscreen() {
  const doc = document as FullscreenDocument;
  return !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

export function exitFullscreen() {
  const doc = document as FullscreenDocument;
  if (!isFullscreen()) return;
  try {
    const result = doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen?.();
    if (result instanceof Promise) result.catch(() => {});
  } catch {
    // egal
  }
}
