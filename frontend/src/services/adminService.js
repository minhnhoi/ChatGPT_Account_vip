import {
  clearCsrfToken,
  csrfHeaders,
  setAdminSession,
} from "./sessionSecurity";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function parseResponse(
  response,
  fallbackMessage = "Request admin bị lỗi",
) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || fallbackMessage);
  const nextSession = {};
  if (data?.data?.csrfToken) nextSession.csrfToken = data.data.csrfToken;
  if (data?.data?.sessionToken)
    nextSession.sessionToken = data.data.sessionToken;
  if (Object.keys(nextSession).length > 0) setAdminSession(nextSession);
  return data;
}

export const adminService = {
  async verifyPassword(adminPassword) {
    const response = await fetch(`${API_URL}/accounts/admin/verify`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...csrfHeaders(),
      },
      body: JSON.stringify({ adminPassword }),
    });

    return parseResponse(response, "Mật khẩu admin không đúng");
  },

  async getSession() {
    const response = await fetch(`${API_URL}/accounts/admin/session`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...csrfHeaders(),
      },
    });

    return parseResponse(response, "Không kiểm tra được phiên admin");
  },

  async logout(adminToken = "") {
    const response = await fetch(`${API_URL}/accounts/admin/logout`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...csrfHeaders(adminToken),
      },
      body: JSON.stringify({}),
    });

    const data = await parseResponse(response, "Không đăng xuất được admin");
    clearCsrfToken();
    return data;
  },
};
