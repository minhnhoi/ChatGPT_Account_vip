import { io } from "socket.io-client";

function backendRootFromApiUrl() {
  const socketUrl = import.meta.env.VITE_SOCKET_URL;
  if (socketUrl) return socketUrl.replace(/\/$/, "");

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  return apiUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");
}

let socketInstance = null;

export function getRealtimeSocket() {
  if (socketInstance) return socketInstance;

  socketInstance = io(backendRootFromApiUrl(), {
    autoConnect: false,
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 8000,
    timeout: 12000,
  });

  return socketInstance;
}

export function closeRealtimeSocket() {
  if (!socketInstance) return;
  socketInstance.removeAllListeners();
  socketInstance.disconnect();
  socketInstance = null;
}
