import crypto from "crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { appendCookie } from "./adminAuth.js";
import { parseCookies, serializeCookie } from "./visitorSession.js";

const AUTH_COOKIE_FALLBACK = "account_hub_user";

function ttlMs() {
  return (
    Math.max(1, Number(env.userSessionDays || env.adminSessionDays || 7)) *
    24 *
    60 *
    60 *
    1000
  );
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

function tokenSecret() {
  return `${env.encryptionKey}:vault-user-auth:v2`;
}

function sign(payloadBase64) {
  return crypto
    .createHmac("sha256", tokenSecret())
    .update(payloadBase64)
    .digest("base64url");
}

function parseToken(token = "") {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payloadBase64, signature] = token.split(".");
  if (!payloadBase64 || !signature) return null;
  const expected = sign(payloadBase64);
  if (!timingSafeStringEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(decodeBase64url(payloadBase64));
    if (!payload?.uid || Number(payload.exp) <= Date.now()) return null;
    if (!payload.role || !["admin", "user"].includes(payload.role)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function isBcryptHash(value = "") {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(String(value || ""));
}

export async function hashPassword(password = "") {
  return bcrypt.hash(String(password), 12);
}

export async function comparePassword(inputPassword = "", passwordHash = "") {
  if (!inputPassword || !passwordHash) return false;
  return bcrypt.compare(String(inputPassword), String(passwordHash));
}

export async function ensureHash(passwordOrHash = "") {
  const value = String(passwordOrHash || "").trim();
  if (!value) return "";
  if (isBcryptHash(value)) return value;
  return hashPassword(value);
}

export function createUserAuthToken(user) {
  const now = Date.now();
  const payload = {
    uid: String(user._id),
    role: user.role || "user",
    username: user.username || "",
    displayName: user.displayName || user.username || "User",
    visitorId: user.linkedVisitorId || "",
    csrf: crypto.randomBytes(32).toString("base64url"),
    iat: now,
    exp: now + ttlMs(),
  };
  const payloadBase64 = base64url(JSON.stringify(payload));
  return {
    token: `${payloadBase64}.${sign(payloadBase64)}`,
    csrfToken: payload.csrf,
    expiresAt: new Date(payload.exp).toISOString(),
    payload,
  };
}

export function getUserAuthTokenFromCookie(req) {
  const cookies = parseCookies(req?.headers?.cookie || "");
  return cookies[env.userCookieName] || cookies[AUTH_COOKIE_FALLBACK] || "";
}

export function getUserAuthTokenFromRequest(req) {
  const cookieToken = getUserAuthTokenFromCookie(req);
  if (cookieToken) return cookieToken;
  return (
    req.get("x-user-session") ||
    req.get("x-auth-session") ||
    req.body?.userSessionToken ||
    ""
  );
}

export function getUserSessionFromRequest(req) {
  return parseToken(getUserAuthTokenFromRequest(req));
}

export function setUserAuthCookie(res, token, expiresAt) {
  if (!res || !token) return;
  const expires = expiresAt
    ? new Date(expiresAt)
    : new Date(Date.now() + ttlMs());
  const maxAge = Math.max(
    1,
    Math.floor((expires.getTime() - Date.now()) / 1000),
  );
  appendCookie(
    res,
    serializeCookie(env.userCookieName, token, {
      path: "/",
      maxAge,
      expires,
      sameSite: env.userCookieSameSite,
      secure: env.userCookieSecure,
      priority: "High",
    }),
  );
}

export function clearUserAuthCookie(res) {
  if (!res) return;
  const options = {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    sameSite: env.userCookieSameSite,
    secure: env.userCookieSecure,
    priority: "High",
  };
  appendCookie(res, serializeCookie(env.userCookieName, "", options));
  if (env.userCookieName !== AUTH_COOKIE_FALLBACK) {
    appendCookie(
      res,
      serializeCookie(AUTH_COOKIE_FALLBACK, "", {
        ...options,
        secure: false,
        sameSite: "Lax",
      }),
    );
  }
}

export function requireLoggedInUser(req, res, next) {
  const session = getUserSessionFromRequest(req);
  if (!session) {
    return res
      .status(401)
      .json({
        success: false,
        message:
          "Bạn cần đăng nhập tài khoản để thực hiện thao tác người dùng.",
      });
  }
  req.authUser = session;
  return next();
}
