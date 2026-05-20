import { csrfHeaders } from "./sessionSecurity";
import {
  getStoredVisitorId,
  saveVisitorSession,
  visitorSessionHeaders,
} from "./visitorSession";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function buildHeaders(visitorId = "", adminToken = "") {
  return {
    "Content-Type": "application/json",
    ...visitorSessionHeaders(visitorId),
    ...csrfHeaders(adminToken),
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Có lỗi xảy ra");
  if (data?.data?.visitorId) saveVisitorSession(data.data);
  return data;
}

export const profileService = {
  getProfile(visitorId = getStoredVisitorId()) {
    const resolvedVisitorId = visitorId || getStoredVisitorId();
    const query = resolvedVisitorId
      ? `?${new URLSearchParams({ visitorId: resolvedVisitorId }).toString()}`
      : "";
    return request(`/profile${query}`, {
      headers: buildHeaders(resolvedVisitorId),
    });
  },

  updateDisplayName(visitorId, displayName, adminToken = "") {
    const resolvedVisitorId = visitorId || getStoredVisitorId();
    return request("/profile/name", {
      method: "PATCH",
      headers: buildHeaders(resolvedVisitorId, adminToken),
      body: JSON.stringify({ visitorId: resolvedVisitorId, displayName }),
    });
  },

  updatePreferences(visitorId, preferences = {}) {
    const resolvedVisitorId = visitorId || getStoredVisitorId();
    return request("/profile/preferences", {
      method: "PATCH",
      headers: buildHeaders(resolvedVisitorId),
      body: JSON.stringify({ visitorId: resolvedVisitorId, preferences }),
    });
  },

  markNotificationsSeen(visitorId, mode, notificationKeys = []) {
    const resolvedVisitorId = visitorId || getStoredVisitorId();
    return request("/profile/notifications/seen", {
      method: "PATCH",
      headers: buildHeaders(resolvedVisitorId),
      body: JSON.stringify({
        visitorId: resolvedVisitorId,
        mode,
        notificationKeys,
      }),
    });
  },
};
