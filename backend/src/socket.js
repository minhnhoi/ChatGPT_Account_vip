import { Server } from "socket.io";
import { env } from "./config/env.js";
import { getAdminSessionFromRequest } from "./utils/adminAuth.js";
import { getVisitorIdFromRequest } from "./utils/visitorSession.js";

let ioInstance = null;

function normalizeAllowedOrigins(allowedOrigins = []) {
  return Array.from(
    new Set(
      allowedOrigins
        .flatMap((origin) => String(origin || "").split(","))
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeSocketRequest(socket) {
  const req = socket?.request || {};
  if (typeof req.get !== "function") {
    req.get = (name = "") => req.headers?.[String(name).toLowerCase()] || "";
  }
  return req;
}

function getSocketVisitorId(socket) {
  try {
    return getVisitorIdFromRequest(normalizeSocketRequest(socket), null, {
      createIfMissing: false,
    });
  } catch {
    return "";
  }
}

function getSocketIsAdmin(socket) {
  try {
    return Boolean(getAdminSessionFromRequest(normalizeSocketRequest(socket)));
  } catch {
    return false;
  }
}

export function initRealtime(server, allowedOrigins = []) {
  const origins = normalizeAllowedOrigins(
    allowedOrigins.length ? allowedOrigins : [env.clientUrl],
  );

  ioInstance = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (origins.includes(origin)) return callback(null, true);
        return callback(
          new Error(`Socket.IO CORS không cho phép origin: ${origin}`),
        );
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
    pingTimeout: 20000,
    pingInterval: 25000,
    serveClient: false,
  });

  ioInstance.on("connection", (socket) => {
    const visitorId = getSocketVisitorId(socket);
    const isAdmin = getSocketIsAdmin(socket);

    if (visitorId) socket.join(`visitor:${visitorId}`);
    if (isAdmin) socket.join("admins");

    socket.emit("accountHub:ready", {
      success: true,
      visitorLinked: Boolean(visitorId),
      adminLinked: Boolean(isAdmin),
      fallbackPollingSeconds: 12,
      connectedAt: new Date().toISOString(),
    });

    socket.on("accountHub:ping", () => {
      socket.emit("accountHub:pong", { at: new Date().toISOString() });
    });
  });

  return ioInstance;
}

function publicPayload(kind, payload = {}) {
  const safe = { ...(payload || {}) };

  delete safe.password;
  delete safe.passwordEncrypted;
  delete safe.otpCode;
  delete safe.appPassword;
  delete safe.appPasswordEncrypted;
  delete safe.loginEmail;
  delete safe.recipientEmail;

  return {
    kind,
    ...safe,
    realtimeAt: new Date().toISOString(),
  };
}

export function emitRealtimeSync(
  kind = "data:changed",
  payload = {},
  options = {},
) {
  if (!ioInstance) return;

  const eventPayload = publicPayload(kind, payload);

  if (options.adminOnly) {
    ioInstance.to("admins").emit("accountHub:sync", eventPayload);
    return;
  }

  if (options.visitorId) {
    ioInstance
      .to(`visitor:${options.visitorId}`)
      .emit("accountHub:sync", eventPayload);
    return;
  }

  ioInstance.emit("accountHub:sync", eventPayload);
}

export function getRealtimeServer() {
  return ioInstance;
}
