import {
  clearCsrfToken,
  csrfHeaders,
  setAdminSession,
  setUserSession,
  clearUserSession,
} from "./sessionSecurity";
import { saveVisitorSession } from "./visitorSession";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function persistAuthPayload(data = {}) {
  if (data?.profile) saveVisitorSession(data.profile);

  const authSession = {};
  if (data?.auth?.csrfToken) authSession.userCsrfToken = data.auth.csrfToken;
  if (data?.auth?.sessionToken)
    authSession.userSessionToken = data.auth.sessionToken;
  if (Object.keys(authSession).length > 0) setUserSession(authSession);

  const adminSession = {};
  if (data?.admin?.csrfToken) adminSession.csrfToken = data.admin.csrfToken;
  if (data?.admin?.sessionToken)
    adminSession.sessionToken = data.admin.sessionToken;
  if (Object.keys(adminSession).length > 0) setAdminSession(adminSession);
}

async function parseResponse(
  response,
  fallbackMessage = "Request auth bị lỗi",
) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || fallbackMessage);
  if (data?.data) persistAuthPayload(data.data);
  return data;
}

export const authService = {
  async getSession() {
    const response = await fetch(`${API_URL}/auth/session`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...csrfHeaders(),
      },
    });
    return parseResponse(response, "Không kiểm tra được phiên đăng nhập");
  },

  async login(payload) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...csrfHeaders(),
      },
      body: JSON.stringify(payload),
    });
    return parseResponse(response, "Đăng nhập thất bại");
  },

  async register(payload) {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return parseResponse(response, "Đăng ký thất bại");
  },

  async logout() {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...csrfHeaders(),
      },
      body: JSON.stringify({}),
    });
    const data = await parseResponse(
      response,
      "Không đăng xuất được tài khoản",
    );
    clearCsrfToken();
    clearUserSession();
    return data;
  },
};
