import ActivityLog from "../models/ActivityLog.js";
import { getVisitorIdFromRequest } from "./visitorSession.js";

function cleanText(value) {
  return String(value || "").trim();
}

function decodeHeaderValue(value) {
  const raw = String(value || "");
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function writeActivityLog({
  req,
  action,
  target = "system",
  targetId = "",
  description = "",
  metadata = {},
}) {
  try {
    const visitorId = cleanText(getVisitorIdFromRequest(req));
    const visitorName = cleanText(
      decodeHeaderValue(
        req?.get?.("x-visitor-name") || req?.headers?.["x-visitor-name"] || "",
      ),
    );
    const normalizedMetadata = { ...metadata };

    if (
      visitorId &&
      !normalizedMetadata.requesterVisitorId &&
      !normalizedMetadata.visitorId
    ) {
      normalizedMetadata.requesterVisitorId = visitorId;
    }

    if (visitorName && !normalizedMetadata.requesterName) {
      normalizedMetadata.requesterName = visitorName;
    }

    await ActivityLog.create({
      action,
      target,
      targetId: targetId ? String(targetId) : "",
      description,
      ip: req?.ip || req?.headers?.["x-forwarded-for"] || "",
      metadata: normalizedMetadata,
    });
  } catch (error) {
    console.warn("Không thể ghi nhật ký hoạt động:", error.message);
  }
}
