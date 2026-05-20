import crypto from "crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { parseCookies, serializeCookie } from "./visitorSession.js";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function getAdminTokenTtlMs() {
  return env.adminSessionDays * 24 * 60 * 60 * 1000;
}

function timingSafeStringEqual(a, b) {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));

  if (bufferA.length !== bufferB.length) {
    crypto.timingSafeEqual(bufferA, bufferA);
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function decodeBase64url(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function getTokenSecret() {
  return `${env.encryptionKey}:${env.adminPasswordHash}`;
}

function sign(payloadBase64) {
  return crypto
    .createHmac("sha256", getTokenSecret())
    .update(payloadBase64)
    .digest("base64url");
}

function isBcryptHash(value = "") {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(String(value || ""));
}

function parseAdminToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;

  const [payloadBase64, signature] = token.split(".");
  if (!payloadBase64 || !signature) return null;

  const expected = sign(payloadBase64);
  if (!timingSafeStringEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(decodeBase64url(payloadBase64));
    if (payload.role !== "admin" || Number(payload.exp) <= Date.now())
      return null;
    return payload;
  } catch {
    return null;
  }
}

export function createAdminToken() {
  const now = Date.now();
  const payload = {
    role: "admin",
    sid: crypto.randomUUID(),
    csrf: crypto.randomBytes(32).toString("base64url"),
    iat: now,
    exp: now + getAdminTokenTtlMs(),
  };

  const payloadBase64 = base64url(JSON.stringify(payload));
  const signature = sign(payloadBase64);

  return {
    token: `${payloadBase64}.${signature}`,
    csrfToken: payload.csrf,
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

export function verifyAdminToken(token) {
  return Boolean(parseAdminToken(token));
}

export async function verifyAdminPassword(inputPassword) {
  if (!inputPassword) return false;

  const storedPassword = env.adminPasswordHash;
  if (!storedPassword) return false;

  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(inputPassword, storedPassword);
  }

  if (env.isProduction) return false;
  return timingSafeStringEqual(inputPassword, storedPassword);
}

export function getAdminPasswordFromRequest(req) {
  return req.body?.adminPassword || "";
}

export function getAdminTokenFromCookie(req) {
  const cookies = parseCookies(req?.headers?.cookie || "");
  return cookies[env.adminCookieName] || cookies.account_hub_admin || "";
}

export function getAdminTokenFromRequest(req) {
  const cookieToken = getAdminTokenFromCookie(req);
  if (cookieToken) return cookieToken;

  const clientSessionToken = req.get("x-admin-session") || "";
  if (clientSessionToken) return clientSessionToken;

  if (!env.allowLegacyAdminToken) return "";

  const authHeader = req.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return req.get("x-admin-token") || req.body?.adminToken || "";
}

export function getAdminSessionFromRequest(req) {
  return parseAdminToken(getAdminTokenFromRequest(req));
}

export function getAdminSessionInfo(req) {
  const session = getAdminSessionFromRequest(req);
  if (!session) return { isAdmin: false };
  return {
    isAdmin: true,
    role: "admin",
    csrfToken: session.csrf || "",
    expiresAt: new Date(session.exp).toISOString(),
    expiresInSeconds: Math.max(
      0,
      Math.floor((Number(session.exp) - Date.now()) / 1000),
    ),
    sessionDays: env.adminSessionDays,
  };
}

export function getCsrfTokenFromRequest(req) {
  return req.get("x-csrf-token") || req.body?.csrfToken || "";
}

export function verifyAdminCsrf(req, session = null) {
  if (!env.enableCsrfProtection) return true;
  if (!UNSAFE_METHODS.has(req.method)) return true;

  const currentSession = session || getAdminSessionFromRequest(req);
  if (!currentSession?.csrf) return false;
  return timingSafeStringEqual(
    getCsrfTokenFromRequest(req),
    currentSession.csrf,
  );
}

export function appendCookie(res, cookieValue) {
  if (!res || !cookieValue) return;
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookieValue);
  } else if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookieValue]);
  } else {
    res.setHeader("Set-Cookie", [existing, cookieValue]);
  }
}

export function setAdminAuthCookie(res, token, expiresAt) {
  if (!res || !token) return;
  const expires = expiresAt
    ? new Date(expiresAt)
    : new Date(Date.now() + getAdminTokenTtlMs());
  const maxAge = Math.max(
    1,
    Math.floor((expires.getTime() - Date.now()) / 1000),
  );
  appendCookie(
    res,
    serializeCookie(env.adminCookieName, token, {
      path: "/",
      maxAge,
      expires,
      sameSite: env.adminCookieSameSite,
      secure: env.adminCookieSecure,
      priority: "High",
    }),
  );
}

export function clearAdminAuthCookie(res) {
  if (!res) return;
  const options = {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    sameSite: env.adminCookieSameSite,
    secure: env.adminCookieSecure,
    priority: "High",
  };
  appendCookie(res, serializeCookie(env.adminCookieName, "", options));

  if (env.adminCookieName !== "account_hub_admin") {
    appendCookie(
      res,
      serializeCookie("account_hub_admin", "", {
        ...options,
        secure: false,
        sameSite: "Lax",
      }),
    );
  }
}

export async function requireAdmin(req, res, next) {
  try {
    const session = getAdminSessionFromRequest(req);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập admin để thực hiện thao tác này.",
      });
    }

    if (!verifyAdminCsrf(req, session)) {
      return res.status(403).json({
        success: false,
        message:
          "Phiên admin thiếu CSRF token hợp lệ. Hãy tải lại web hoặc đăng nhập lại admin.",
      });
    }

    req.isAdmin = true;
    req.adminSession = session;
    return next();
  } catch (error) {
    return next(error);
  }
}
