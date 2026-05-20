import { csrfHeaders } from "./sessionSecurity";
import { safeHeaderValue, visitorSessionHeaders } from "./visitorSession";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function simpleHash(input = "") {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function getClientFingerprint() {
  if (typeof window === "undefined") return "server";

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown-tz";
  const screenInfo = window.screen
    ? `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`
    : "unknown-screen";
  const parts = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    tz,
    screenInfo,
    navigator.hardwareConcurrency || "hc0",
    navigator.deviceMemory || "mem0",
  ];

  return `fp_${simpleHash(parts.join("|"))}`;
}

function buildHeaders({
  adminToken = "",
  visitorName = "",
  visitorId = "",
} = {}) {
  const headers = {
    ...csrfHeaders(adminToken),
    ...visitorSessionHeaders(visitorId),
  };
  if (visitorName) headers["X-Visitor-Name"] = safeHeaderValue(visitorName);
  if (typeof window !== "undefined") {
    headers["X-Client-Fingerprint"] = safeHeaderValue(getClientFingerprint());
    headers["X-Client-Timezone"] = safeHeaderValue(
      Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    );
    headers["X-Client-Platform"] = safeHeaderValue(navigator.platform || "");
    headers["X-Client-Screen"] = safeHeaderValue(
      window.screen
        ? `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`
        : "",
    );
  }
  return headers;
}

async function request(path, options = {}) {
  const { headers = {}, ...fetchOptions } = options;

  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Có lỗi xảy ra");
  }

  return data;
}

export const accountService = {
  getAccounts(params = {}, adminToken = "", visitorName = "", visitorId = "") {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== "all") query.set(key, value);
    });

    const queryString = query.toString();
    return request(`/accounts${queryString ? `?${queryString}` : ""}`, {
      headers: buildHeaders({ adminToken, visitorName, visitorId }),
    });
  },

  getStats() {
    return request("/accounts/stats");
  },

  createAccount(payload, adminToken, visitorName = "", visitorId = "") {
    return request("/accounts", {
      method: "POST",
      headers: buildHeaders({ adminToken, visitorName, visitorId }),
      body: JSON.stringify(payload),
    });
  },

  updateAccount(id, payload, adminToken, visitorName = "", visitorId = "") {
    return request(`/accounts/${id}`, {
      method: "PUT",
      headers: buildHeaders({ adminToken, visitorName, visitorId }),
      body: JSON.stringify({
        ...payload,
        requesterName: visitorName,
        requesterVisitorId: visitorId,
      }),
    });
  },

  deleteAccount(id, adminToken) {
    return request(`/accounts/${id}`, {
      method: "DELETE",
      headers: buildHeaders({ adminToken }),
    });
  },

  revealPassword(id, adminToken, visitorName = "", visitorId = "") {
    return request(`/accounts/${id}/reveal-password`, {
      method: "POST",
      headers: buildHeaders({ adminToken, visitorName, visitorId }),
      body: JSON.stringify({
        requesterName: visitorName,
        requesterVisitorId: visitorId,
      }),
    });
  },

  renameVisitorName(oldName, newName, adminToken = "") {
    return request("/accounts/visitor-name", {
      method: "PATCH",
      headers: buildHeaders({ adminToken, visitorName: oldName }),
      body: JSON.stringify({ oldName, newName }),
    });
  },

  requestAccess(id, visitorName = "", visitorId = "") {
    return request(`/accounts/${id}/request-access`, {
      method: "POST",
      headers: buildHeaders({ visitorName, visitorId }),
      body: JSON.stringify({
        requesterName: visitorName,
        requesterVisitorId: visitorId,
      }),
    });
  },

  approveAccess(id, requestId, adminToken) {
    return request(`/accounts/${id}/access/${requestId}/approve`, {
      method: "POST",
      headers: buildHeaders({ adminToken }),
      body: JSON.stringify({}),
    });
  },

  rejectAccess(id, requestId, adminToken, reason = "") {
    return request(`/accounts/${id}/access/${requestId}/reject`, {
      method: "POST",
      headers: buildHeaders({ adminToken }),
      body: JSON.stringify({ reason }),
    });
  },

  revokeAccess(id, requestId, adminToken, reason = "") {
    return request(`/accounts/${id}/access/${requestId}/revoke`, {
      method: "POST",
      headers: buildHeaders({ adminToken }),
      body: JSON.stringify({ reason }),
    });
  },

  deleteAccess(id, requestId, adminToken, reason = "") {
    return request(`/accounts/${id}/access/${requestId}/delete`, {
      method: "POST",
      headers: buildHeaders({ adminToken }),
      body: JSON.stringify({ reason }),
    });
  },
};
