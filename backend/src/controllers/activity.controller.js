import ActivityLog from "../models/ActivityLog.js";
import { getAdminSessionFromRequest } from "../utils/adminAuth.js";
import { getVisitorIdFromRequest } from "../utils/visitorSession.js";

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

function escapeRegex(value) {
  return cleanText(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getActivityLogs(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const isAdmin = Boolean(getAdminSessionFromRequest(req));
    const visitorName = cleanText(
      decodeHeaderValue(req.get("x-visitor-name")) || req.query.visitorName,
    ).slice(0, 80);
    const visitorId = getVisitorIdFromRequest(req);
    const filter = {};

    if (!isAdmin) {
      if (!visitorName && !visitorId) {
        return res.json({ success: true, count: 0, data: [] });
      }

      const orFilters = [];
      if (visitorId) {
        orFilters.push({ "metadata.requesterVisitorId": visitorId });
        orFilters.push({ "metadata.visitorId": visitorId });
      }
      if (visitorName) {
        orFilters.push({
          "metadata.requesterName": {
            $regex: `^${escapeRegex(visitorName)}$`,
            $options: "i",
          },
        });
      }
      filter.$or = orFilters;
    }

    const logs = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
}
