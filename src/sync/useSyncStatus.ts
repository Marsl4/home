import { useEffect, useState } from "react";

import { getStatus, subscribeStatus, type SyncStatus } from "./engine";

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState(getStatus);
  useEffect(() => {
    const unsubscribe = subscribeStatus(setStatus);
    return () => {
      unsubscribe();
    };
  }, []);
  return status;
}

// Kurzer Text für den Zustand, z. B. "Zuletzt abgeglichen 14:32".
export function describeStatus(status: SyncStatus): string {
  const time = (ms: number | null) =>
    ms ? new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "noch nie";
  switch (status.state) {
    case "off":
      return "Sync ist aus";
    case "needs-auth":
      return "Tippen, um wieder zu verbinden";
    case "syncing":
      return "Gleiche ab …";
    case "ok":
      return `Abgeglichen um ${time(status.lastSyncedAt)}`;
    case "error":
      return `Problem: ${status.message}`;
  }
}
