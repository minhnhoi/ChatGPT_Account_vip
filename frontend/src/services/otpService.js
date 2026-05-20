import { csrfHeaders } from "./sessionSecurity";
import { safeHeaderValue, visitorSessionHeaders } from "./visitorSession";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function buildHeaders({
  adminToken = "",
  visitorName = "",
  visitorId = "",
} = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...csrfHeaders(adminToken),
    ...visitorSessionHeaders(visitorId),
  };
  if (visitorName) headers["X-Visitor-Name"] = safeHeaderValue(visitorName);
  return headers;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Có lỗi OTP xảy ra");
    error.status = response.status;
    error.cooldownRemainingSeconds = data.cooldownRemainingSeconds || 0;
    error.cooldownAvailableAt = data.cooldownAvailableAt || "";
    throw error;
  }
  return data;
}

export const otpService = {
  getConfig(adminToken) {
    return request("/otp/config", { headers: buildHeaders({ adminToken }) });
  },

  saveConfig(payload, adminToken) {
    return request("/otp/config", {
      method: "PUT",
      headers: buildHeaders({ adminToken }),
      body: JSON.stringify(payload),
    });
  },

  testConfig(adminToken) {
    return request("/otp/config/test", {
      method: "POST",
      headers: buildHeaders({ adminToken }),
      body: JSON.stringify({}),
    });
  },

  getLogs({
    adminToken = "",
    visitorName = "",
    visitorId = "",
    limit = 180,
  } = {}) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (visitorName) query.set("requesterName", visitorName);
    if (visitorId) query.set("visitorId", visitorId);
    return request(`/otp/logs?${query.toString()}`, {
      headers: buildHeaders({ adminToken, visitorName, visitorId }),
    });
  },

  bindAccount(
    accountId,
    { adminToken = "", visitorName = "", visitorId = "" } = {},
  ) {
    return request(`/otp/accounts/${accountId}/bind`, {
      method: "POST",
      headers: buildHeaders({ adminToken, visitorName, visitorId }),
      body: JSON.stringify({
        requesterName: visitorName,
        requesterVisitorId: visitorId,
      }),
    });
  },

  getOtp(
    accountId,
    { adminToken = "", visitorName = "", visitorId = "" } = {},
  ) {
    return request(`/otp/accounts/${accountId}/get`, {
      method: "POST",
      headers: buildHeaders({ adminToken, visitorName, visitorId }),
      body: JSON.stringify({
        requesterName: visitorName,
        requesterVisitorId: visitorId,
      }),
    });
  },

  confirmLogin(
    accountId,
    { adminToken = "", visitorName = "", visitorId = "", logId = "" } = {},
  ) {
    return request(`/otp/accounts/${accountId}/confirm-login`, {
      method: "POST",
      headers: buildHeaders({ adminToken, visitorName, visitorId }),
      body: JSON.stringify({
        requesterName: visitorName,
        requesterVisitorId: visitorId,
        logId,
      }),
    });
  },
};
