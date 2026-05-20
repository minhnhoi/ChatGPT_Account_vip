const VISITOR_ID_KEY = "vault_visitor_id";
const VISITOR_TOKEN_KEY = "vault_visitor_token";

export function safeHeaderValue(value = "") {
  return encodeURIComponent(String(value));
}

function readStorage(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStorage(key, value = "") {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {}
}

export function getStoredVisitorId() {
  return readStorage(VISITOR_ID_KEY);
}

export function getStoredVisitorToken() {
  return readStorage(VISITOR_TOKEN_KEY);
}

export function saveVisitorSession(profile = {}) {
  const visitorId = String(profile?.visitorId || "").trim();
  const visitorToken = String(
    profile?.visitorClientToken || profile?.clientToken || "",
  ).trim();

  if (visitorId) writeStorage(VISITOR_ID_KEY, visitorId);
  if (visitorToken) writeStorage(VISITOR_TOKEN_KEY, visitorToken);
}

export function clearVisitorSession() {
  writeStorage(VISITOR_ID_KEY, "");
  writeStorage(VISITOR_TOKEN_KEY, "");
}

export function visitorSessionHeaders(visitorId = "") {
  const resolvedVisitorId = String(
    visitorId || getStoredVisitorId() || "",
  ).trim();
  const visitorToken = getStoredVisitorToken();
  const headers = {};

  if (resolvedVisitorId)
    headers["X-Visitor-Id"] = safeHeaderValue(resolvedVisitorId);
  if (visitorToken) headers["X-Visitor-Token"] = safeHeaderValue(visitorToken);

  return headers;
}
