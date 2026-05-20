import { csrfHeaders } from "./sessionSecurity";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function adminHeaders(adminToken) {
  return csrfHeaders(adminToken);
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Backup bị lỗi");
  return data;
}

export const backupService = {
  async exportBackup(adminToken) {
    const response = await fetch(`${API_URL}/backup/export`, {
      credentials: "include",
      headers: adminHeaders(adminToken),
    });
    return parseResponse(response);
  },

  async importBackup(payload, adminToken) {
    const response = await fetch(`${API_URL}/backup/import`, {
      credentials: "include",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...adminHeaders(adminToken),
      },
      body: JSON.stringify(payload),
    });
    return parseResponse(response);
  },
};
