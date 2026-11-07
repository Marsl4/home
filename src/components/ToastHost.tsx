// Zeigt Hinweis-Meldungen an (siehe toast.ts). Jede Meldung verschwindet nach ein paar Sekunden.
import { useEffect, useState } from "react";

import { onToast, type ToastMessage } from "./toast";

const VISIBLE_MS = 4000;

export function ToastHost() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(
    () =>
      onToast((message) => {
        setMessages((current) => [...current, message]);
        setTimeout(() => setMessages((current) => current.filter((m) => m.id !== message.id)), VISIBLE_MS);
      }),
    [],
  );

  return (
    <div className="toasts" aria-live="polite">
      {messages.map((message) => (
        <div key={message.id} className="toast">
          <span>{message.text}</span>
          {message.action && (
            <button className="toast-action" onClick={message.action.onClick}>
              {message.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
