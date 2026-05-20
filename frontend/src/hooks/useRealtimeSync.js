import { useEffect, useRef, useState } from "react";
import { getRealtimeSocket } from "../services/realtimeService";

const DEFAULT_POLLING_MS = 12000;
const MIN_SYNC_GAP_MS = 1200;

export function useRealtimeSync({
  enabled = true,
  onSync,
  pollingMs = DEFAULT_POLLING_MS,
} = {}) {
  const [status, setStatus] = useState("idle");
  const lastSyncAtRef = useRef(0);
  const onSyncRef = useRef(onSync);

  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  useEffect(() => {
    if (!enabled) {
      setStatus("disabled");
      return undefined;
    }

    let alive = true;
    let pollingTimer = null;

    async function runSync(reason = "unknown", payload = {}) {
      if (!alive || typeof onSyncRef.current !== "function") return;

      const now = Date.now();
      if (now - lastSyncAtRef.current < MIN_SYNC_GAP_MS && reason !== "polling")
        return;
      lastSyncAtRef.current = now;

      try {
        await onSyncRef.current({ reason, payload });
        window.dispatchEvent(
          new CustomEvent("accountHub:realtime-sync", {
            detail: { reason, payload },
          }),
        );
      } catch {}
    }

    function startPolling() {
      if (pollingTimer) clearInterval(pollingTimer);
      pollingTimer = setInterval(
        () => {
          if (document.visibilityState === "hidden") return;
          runSync("polling", { kind: "polling:fallback" });
        },
        Math.max(5000, Number(pollingMs) || DEFAULT_POLLING_MS),
      );
    }

    const socket = getRealtimeSocket();

    const handleReady = (payload) => {
      setStatus(socket.connected ? "connected" : "polling");
      runSync("socket:ready", payload || {});
    };

    const handleSync = (payload) => {
      setStatus("connected");
      runSync("socket:event", payload || {});
    };

    const handleConnect = () => setStatus("connected");
    const handleDisconnect = () => setStatus("polling");
    const handleError = () => setStatus("polling");

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleError);
    socket.on("accountHub:ready", handleReady);
    socket.on("accountHub:sync", handleSync);

    if (!socket.connected) socket.connect();
    startPolling();
    setStatus(socket.connected ? "connected" : "polling");

    return () => {
      alive = false;
      if (pollingTimer) clearInterval(pollingTimer);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleError);
      socket.off("accountHub:ready", handleReady);
      socket.off("accountHub:sync", handleSync);
    };
  }, [enabled, pollingMs]);

  return { status };
}
