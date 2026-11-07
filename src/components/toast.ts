// Kurze Hinweis-Meldungen unten im Fenster (z. B. "Ausschnitt kopiert").
// Aufruf von überall: showToast("Text") – angezeigt werden sie von <ToastHost /> in App.tsx.

export type ToastAction = { label: string; onClick: () => void };

export type ToastMessage = {
  id: number;
  text: string;
  action?: ToastAction;
};

const EVENT_NAME = "app-toast";
let nextId = 1;

export function showToast(text: string, action?: ToastAction) {
  const message: ToastMessage = { id: nextId++, text, action };
  window.dispatchEvent(new CustomEvent<ToastMessage>(EVENT_NAME, { detail: message }));
}

export function onToast(listener: (message: ToastMessage) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<ToastMessage>).detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
