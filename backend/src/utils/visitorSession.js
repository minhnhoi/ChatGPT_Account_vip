import crypto from "crypto";
import { env } from "../config/env.js";

function timingSafeStringEqual(a, b) {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));

  if (bufferA.length !== bufferB.length) {
    crypto.timingSafeEqual(bufferA, bufferA);
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

export function parseCookies(cookieHeader = "") {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const equalIndex = part.indexOf("=");
      if (equalIndex === -1) return cookies;
      const key = part.slice(0, equalIndex).trim();
      const value = part.slice(equalIndex + 1).trim();
      if (!key) return cookies;
      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }
      return cookies;
    }, {});
}

export function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || "/"}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.maxAge !== undefined)
    parts.push(`Max-Age=${Math.max(0, Number(options.maxAge) || 0)}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  if (options.priority) parts.push(`Priority=${options.priority}`);
  return parts.join("; ");
}

function signVisitorId(visitorId) {
  return crypto
    .createHmac("sha256", `${env.encryptionKey}:visitor-session`)
    .update(String(visitorId))
    .digest("base64url");
}

function encodeVisitorCookie(visitorId) {
  return `${visitorId}.${signVisitorId(visitorId)}`;
}

export function createVisitorClientToken(visitorId) {
  return visitorId ? encodeVisitorCookie(visitorId) : "";
}

function decodeVisitorCookie(value = "") {
  const [visitorId, signature] = String(value || "").split(".");
  if (!visitorId || !signature) return "";
  const expected = signVisitorId(visitorId);
  return timingSafeStringEqual(signature, expected) ? visitorId : "";
}

function readVisitorCookie(req) {
  const cookies = parseCookies(req?.headers?.cookie || "");
  return decodeVisitorCookie(cookies[env.visitorCookieName] || "");
}

function readSignedVisitorToken(req) {
  const raw =
    req?.get?.("x-visitor-token") ||
    req?.body?.visitorToken ||
    req?.query?.visitorToken ||
    "";
  if (!raw) return "";

  let decoded = "";
  try {
    decoded = decodeURIComponent(String(raw));
  } catch {
    decoded = String(raw);
  }

  return decodeVisitorCookie(decoded);
}

export function setVisitorCookie(res, visitorId) {
  if (!res || !visitorId) return;
  const maxAge = env.visitorCookieMaxAgeDays * 24 * 60 * 60;
  res.cookie?.(env.visitorCookieName, encodeVisitorCookie(visitorId), {
    httpOnly: true,
    secure: env.visitorCookieSecure,
    sameSite: env.visitorCookieSameSite,
    maxAge: maxAge * 1000,
    path: "/",
  });

  if (!res.cookie) {
    res.append(
      "Set-Cookie",
      serializeCookie(env.visitorCookieName, encodeVisitorCookie(visitorId), {
        path: "/",
        httpOnly: true,
        maxAge,
        expires: new Date(Date.now() + maxAge * 1000),
        sameSite: env.visitorCookieSameSite,
        secure: env.visitorCookieSecure,
        priority: "High",
      }),
    );
  }
}

function sanitizeClientVisitorId(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._:-]/g, "")
    .slice(0, 120);
}

function getLegacyVisitorIdFromRequest(req) {
  if (!env.allowLegacyVisitorHeader) return "";

  const raw =
    req.get("x-visitor-id") ||
    req.body?.visitorId ||
    req.body?.requesterVisitorId ||
    req.query?.visitorId;
  let decoded = "";
  try {
    decoded = decodeURIComponent(String(raw || ""));
  } catch {
    decoded = String(raw || "");
  }
  return sanitizeClientVisitorId(decoded);
}

export function getVisitorIdFromRequest(req, res = null, options = {}) {
  const { createIfMissing = false } = options;
  const fromCookie = readVisitorCookie(req);
  if (fromCookie) return fromCookie;

  const fromSignedClientToken = readSignedVisitorToken(req);
  if (fromSignedClientToken) {
    setVisitorCookie(res, fromSignedClientToken);
    return fromSignedClientToken;
  }

  const legacyVisitorId = getLegacyVisitorIdFromRequest(req);
  if (legacyVisitorId) {
    setVisitorCookie(res, legacyVisitorId);
    return legacyVisitorId;
  }

  if (!createIfMissing) return "";

  const visitorId = crypto.randomUUID();
  setVisitorCookie(res, visitorId);
  return visitorId;
}
