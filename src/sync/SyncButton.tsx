// Sync-Knopf in der linken Leiste mit "Ampel":
// grün = verbunden, orange = Stunde abgelaufen (tippen), rot = Problem, grau = aus.
import { Cloud, CloudOff, RefreshCw } from "lucide-react";

import { clientId } from "./config";
import { connect, syncNow } from "./engine";
import { describeStatus, useSyncStatus } from "./useSyncStatus";

export function SyncButton({ onOpenSettings }: { onOpenSettings: () => void }) {
  const status = useSyncStatus();

  const handleClick = () => {
    if (!clientId() || status.state === "off") return onOpenSettings(); // erst einrichten
    if (status.state === "ok" || status.state === "syncing") return syncNow();
    connect(); // abgelaufen oder Problem: neu verbinden (öffnet ggf. kurz das Google-Fenster)
  };

  const Icon = status.state === "off" ? CloudOff : status.state === "syncing" ? RefreshCw : Cloud;
  return (
    <button className={`rail-item sync-${status.state}`} onClick={handleClick} title={describeStatus(status)}>
      <span className="sync-icon">
        <Icon size={20} strokeWidth={1.75} className={status.state === "syncing" ? "spin" : undefined} />
        {status.state !== "off" && <span className="sync-dot" />}
      </span>
      <span className="rail-label">Sync</span>
    </button>
  );
}
