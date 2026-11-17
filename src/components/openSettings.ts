// Aus einer beliebigen Ansicht zu einer Einstellungsseite springen (z. B. „Zu den GitHub-Einstellungen“).
// Die Ansicht schickt eine Nachricht, App.tsx hört darauf und öffnet die Seite in der aktiven Hälfte.
import { useEffect, useRef } from "react";

const EVENT = "home:open-settings";

export function requestOpenSettings(page: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: page }));
}

export function useOpenSettingsRequests(open: (page: string) => void) {
  const handler = useRef(open);
  useEffect(() => {
    handler.current = open;
  });
  useEffect(() => {
    const listener = (e: Event) => handler.current((e as CustomEvent<string>).detail);
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
  }, []);
}
