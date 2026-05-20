const CSRF_KEY = "vault_admin_csrf_token";
const ADMIN_SESSION_KEY = "vault_admin_session_token";
const USER_CSRF_KEY = "vault_user_csrf_token";
const USER_SESSION_KEY = "vault_user_session_token";

function readSessionValue(key) {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeSessionValue(key, value = "") {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {}
}

export function getCsrfToken() {
  return readSessionValue(CSRF_KEY);
}

export function setCsrfToken(token = "") {
  writeSessionValue(CSRF_KEY, token);
}

export function getAdminSessionToken() {
  return readSessionValue(ADMIN_SESSION_KEY);
}

export function setAdminSessionToken(token = "") {
  writeSessionValue(ADMIN_SESSION_KEY, token);
}

export function setAdminSession({ csrfToken, sessionToken } = {}) {
  if (csrfToken !== undefined) setCsrfToken(csrfToken);
  if (sessionToken !== undefined) setAdminSessionToken(sessionToken);
}

export function getUserCsrfToken() {
  return readSessionValue(USER_CSRF_KEY);
}

export function getUserSessionToken() {
  return readSessionValue(USER_SESSION_KEY);
}

export function setUserSession({ userCsrfToken, userSessionToken } = {}) {
  if (userCsrfToken !== undefined)
    writeSessionValue(USER_CSRF_KEY, userCsrfToken);
  if (userSessionToken !== undefined)
    writeSessionValue(USER_SESSION_KEY, userSessionToken);
}

export function clearUserSession() {
  writeSessionValue(USER_CSRF_KEY, "");
  writeSessionValue(USER_SESSION_KEY, "");
}

export function clearCsrfToken() {
  setCsrfToken("");
  setAdminSessionToken("");
}

export function csrfHeaders(token = "") {
  const csrfToken = token || getCsrfToken();
  const sessionToken = getAdminSessionToken();
  const userSessionToken = getUserSessionToken();
  const headers = {};

  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  if (sessionToken) headers["X-Admin-Session"] = sessionToken;
  if (userSessionToken) headers["X-User-Session"] = userSessionToken;

  return headers;
}
