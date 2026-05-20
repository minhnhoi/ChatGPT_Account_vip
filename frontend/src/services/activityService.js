import { csrfHeaders } from "./sessionSecurity";
import { safeHeaderValue, visitorSessionHeaders } from "./visitorSession";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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
    throw new Error(data.message || "Không thể tải dữ liệu");
  }

  return data;
}

export const activityService = {
  getLogs(
    limit = 80,
    { adminToken = "", visitorName = "", visitorId = "" } = {},
  ) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (visitorName) query.set("visitorName", visitorName);
    if (visitorId) query.set("visitorId", visitorId);
    return request(`/activity?${query.toString()}`, {
      headers: buildHeaders({ adminToken, visitorName, visitorId }),
    });
  },
};
