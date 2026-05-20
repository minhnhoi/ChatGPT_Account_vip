import dotenv from "dotenv";

import bcrypt from "bcryptjs";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

function boolFromEnv(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

function numberFromEnv(
  value,
  fallback,
  { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {},
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function cleanEnvValue(value) {
  if (value === undefined || value === null) return value;
  return String(value)
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function cookieSecureFromEnv(value, fallback = false) {
  const requested = boolFromEnv(value, fallback);

  if (
    !isProduction &&
    requested &&
    !boolFromEnv(process.env.FORCE_SECURE_COOKIES, false)
  ) {
    return false;
  }

  return requested;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction,
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGODB_URI,
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  adminPassword: cleanEnvValue(process.env.ADMIN_PASSWORD),
  adminPasswordHash: cleanEnvValue(
    process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD,
  ),
  adminSessionDays: numberFromEnv(process.env.ADMIN_SESSION_DAYS, 7, {
    min: 1,
    max: 90,
  }),
  userSessionDays: numberFromEnv(
    process.env.USER_SESSION_DAYS,
    Number(process.env.ADMIN_SESSION_DAYS || 7),
    { min: 1, max: 90 },
  ),
  bootstrapAdminUsername: cleanEnvValue(process.env.ADMIN_USERNAME || "admin"),
  bootstrapAdminDisplayName: cleanEnvValue(
    process.env.ADMIN_DISPLAY_NAME || "Admin",
  ),
  bootstrapAdminEmail: cleanEnvValue(process.env.ADMIN_EMAIL || ""),
  encryptionKey: process.env.ENCRYPTION_KEY,
  adminCookieName:
    process.env.ADMIN_COOKIE_NAME ||
    (isProduction ? "__Host-account_hub_admin" : "account_hub_admin"),
  adminCookieSameSite:
    process.env.ADMIN_COOKIE_SAMESITE || (isProduction ? "None" : "Lax"),
  adminCookieSecure: cookieSecureFromEnv(
    process.env.ADMIN_COOKIE_SECURE,
    isProduction,
  ),
  visitorCookieName:
    process.env.VISITOR_COOKIE_NAME ||
    (isProduction ? "__Host-account_hub_visitor" : "account_hub_visitor"),
  userCookieName:
    process.env.USER_COOKIE_NAME ||
    (isProduction ? "__Host-account_hub_user" : "account_hub_user"),
  visitorCookieSameSite:
    process.env.VISITOR_COOKIE_SAMESITE || (isProduction ? "None" : "Lax"),
  userCookieSameSite:
    process.env.USER_COOKIE_SAMESITE ||
    process.env.VISITOR_COOKIE_SAMESITE ||
    (isProduction ? "None" : "Lax"),
  visitorCookieSecure: cookieSecureFromEnv(
    process.env.VISITOR_COOKIE_SECURE,
    isProduction,
  ),
  userCookieSecure: cookieSecureFromEnv(
    process.env.USER_COOKIE_SECURE ?? process.env.VISITOR_COOKIE_SECURE,
    isProduction,
  ),
  visitorCookieMaxAgeDays: Math.min(
    3650,
    Math.max(1, Number(process.env.VISITOR_COOKIE_MAX_AGE_DAYS || 365)),
  ),
  enableCsrfProtection: boolFromEnv(process.env.ENABLE_CSRF_PROTECTION, true),
  allowLegacyAdminToken: boolFromEnv(
    process.env.ALLOW_LEGACY_ADMIN_TOKEN,
    false,
  ),
  allowLegacyVisitorHeader: boolFromEnv(
    process.env.ALLOW_LEGACY_VISITOR_HEADER,
    !isProduction,
  ),
  maxJsonSize: process.env.MAX_JSON_SIZE || "1mb",
  otpScanCooldownSeconds: Math.min(
    3600,
    Math.max(5, Number(process.env.OTP_SCAN_COOLDOWN_SECONDS || 45)),
  ),
};

function isBcryptHash(value = "") {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(String(value || ""));
}

export function validateEnv() {
  const missing = [];

  if (!env.mongoUri) missing.push("MONGODB_URI");
  if (!env.adminPasswordHash)
    missing.push(
      isProduction
        ? "ADMIN_PASSWORD_HASH"
        : "ADMIN_PASSWORD hoặc ADMIN_PASSWORD_HASH",
    );
  if (!env.encryptionKey) missing.push("ENCRYPTION_KEY");

  if (missing.length > 0) {
    throw new Error(`Thiếu biến môi trường: ${missing.join(", ")}`);
  }

  if (!/^[a-fA-F0-9]{64}$/.test(env.encryptionKey)) {
    throw new Error(
      "ENCRYPTION_KEY phải là chuỗi hex 64 ký tự. Chạy: npm run key rồi copy vào .env",
    );
  }

  if (!["Strict", "Lax", "None"].includes(env.adminCookieSameSite)) {
    throw new Error("ADMIN_COOKIE_SAMESITE chỉ được là Strict, Lax hoặc None");
  }

  if (!["Strict", "Lax", "None"].includes(env.visitorCookieSameSite)) {
    throw new Error(
      "VISITOR_COOKIE_SAMESITE chỉ được là Strict, Lax hoặc None",
    );
  }

  if (!["Strict", "Lax", "None"].includes(env.userCookieSameSite)) {
    throw new Error("USER_COOKIE_SAMESITE chỉ được là Strict, Lax hoặc None");
  }

  if (env.adminCookieSameSite === "None" && !env.adminCookieSecure) {
    throw new Error(
      "ADMIN_COOKIE_SAMESITE=None bắt buộc ADMIN_COOKIE_SECURE=true để trình duyệt nhận cookie.",
    );
  }

  if (env.visitorCookieSameSite === "None" && !env.visitorCookieSecure) {
    throw new Error(
      "VISITOR_COOKIE_SAMESITE=None bắt buộc VISITOR_COOKIE_SECURE=true để trình duyệt nhận cookie.",
    );
  }

  if (env.userCookieSameSite === "None" && !env.userCookieSecure) {
    throw new Error(
      "USER_COOKIE_SAMESITE=None bắt buộc USER_COOKIE_SECURE=true để trình duyệt nhận cookie.",
    );
  }

  if (
    isProduction &&
    (!env.adminCookieSecure ||
      !env.visitorCookieSecure ||
      !env.userCookieSecure)
  ) {
    throw new Error(
      "Production bắt buộc ADMIN_COOKIE_SECURE=true, VISITOR_COOKIE_SECURE=true và USER_COOKIE_SECURE=true. Hãy chạy qua HTTPS.",
    );
  }

  if (
    env.adminCookieName.startsWith("__Host-") &&
    (!env.adminCookieSecure || env.adminCookieName.includes(";"))
  ) {
    throw new Error(
      "Cookie __Host- bắt buộc Secure và không được cấu hình domain.",
    );
  }

  if (env.visitorCookieName.startsWith("__Host-") && !env.visitorCookieSecure) {
    throw new Error(
      "Visitor cookie __Host- bắt buộc VISITOR_COOKIE_SECURE=true.",
    );
  }

  if (env.userCookieName.startsWith("__Host-") && !env.userCookieSecure) {
    throw new Error("User cookie __Host- bắt buộc USER_COOKIE_SECURE=true.");
  }

  if (isProduction && !isBcryptHash(env.adminPasswordHash)) {
    throw new Error(
      "Production bắt buộc ADMIN_PASSWORD_HASH là bcrypt hash. Chạy: npm run hash:admin -- 'mat-khau-manh'",
    );
  }

  if (
    !isProduction &&
    env.adminPasswordHash &&
    !isBcryptHash(env.adminPasswordHash) &&
    env.adminPasswordHash.length < 8
  ) {
    throw new Error("ADMIN_PASSWORD ở môi trường dev nên có ít nhất 8 ký tự.");
  }

  if (
    !Number.isFinite(env.adminSessionDays) ||
    env.adminSessionDays < 1 ||
    env.adminSessionDays > 90
  ) {
    throw new Error("ADMIN_SESSION_DAYS phải nằm trong khoảng 1 đến 90 ngày.");
  }
}

export async function hashAdminPassword(password) {
  return bcrypt.hash(password, 12);
}
