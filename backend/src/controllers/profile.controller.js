import Account from "../models/Account.js";
import VisitorProfile, {
  DEFAULT_PROFILE_PREFERENCES,
} from "../models/VisitorProfile.js";
import { writeActivityLog } from "../utils/auditLog.js";
import {
  createVisitorClientToken,
  getVisitorIdFromRequest,
} from "../utils/visitorSession.js";
import { emitRealtimeSync } from "../socket.js";

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

function sameName(a, b) {
  return cleanText(a).toLowerCase() === cleanText(b).toLowerCase();
}

function getVisitorId(req, res = null, options = {}) {
  return getVisitorIdFromRequest(req, res, {
    createIfMissing: Boolean(options.createIfMissing),
  });
}

function normalizePreferences(preferences = {}) {
  return {
    ...DEFAULT_PROFILE_PREFERENCES,
    ...Object.fromEntries(
      Object.entries(preferences || {}).filter(
        ([, value]) => value !== undefined && value !== null && value !== "",
      ),
    ),
    reminderDays: Math.min(
      365,
      Math.max(
        1,
        Number(
          preferences?.reminderDays || DEFAULT_PROFILE_PREFERENCES.reminderDays,
        ),
      ),
    ),
  };
}

const RESERVED_DISPLAY_NAMES = new Set([
  "admin",
  "administrator",
  "system",
  "root",
]);

function profileResponseData(profile, visitorId = "") {
  const data =
    typeof profile?.toObject === "function"
      ? profile.toObject()
      : { ...(profile || {}) };
  data.visitorClientToken = createVisitorClientToken(
    visitorId || data.visitorId,
  );
  return data;
}

function isReservedDisplayName(name = "") {
  return RESERVED_DISPLAY_NAMES.has(cleanText(name).toLowerCase());
}

function accessRequestMatchesVisitor(request, visitorId, oldName = "") {
  if (!request) return false;
  const requestVisitorId = cleanText(request.requesterVisitorId);
  if (visitorId && requestVisitorId && requestVisitorId === visitorId)
    return true;
  return oldName && sameName(request.requesterName, oldName);
}

function newestConfirmedApprovedRequest(accessRequests = []) {
  return [...accessRequests]
    .filter(
      (request) => request.status === "approved" && request.loginConfirmedAt,
    )
    .sort(
      (a, b) =>
        new Date(b.loginConfirmedAt || b.decidedAt || b.requestedAt || 0) -
        new Date(a.loginConfirmedAt || a.decidedAt || a.requestedAt || 0),
    )[0];
}

async function syncGrantedOwnershipForProfileRename({
  visitorId,
  oldName,
  newName,
}) {
  const trimmedVisitorId = cleanText(visitorId);
  const trimmedOldName = cleanText(oldName);
  const trimmedNewName = cleanText(newName);

  if (!trimmedNewName || sameName(trimmedNewName, "non")) {
    return { updatedAccounts: 0, updatedRequests: 0 };
  }

  const lookupConditions = [
    { "accessRequests.requesterVisitorId": trimmedVisitorId },
  ];
  if (trimmedOldName && !sameName(trimmedOldName, "non")) {
    lookupConditions.push({ "accessRequests.requesterName": trimmedOldName });
  }

  const accounts = await Account.find({
    accessRequests: {
      $elemMatch: {
        status: "approved",
        $or: lookupConditions,
      },
    },
  });

  let updatedAccounts = 0;
  let updatedRequests = 0;

  for (const account of accounts) {
    let touched = false;

    for (const request of account.accessRequests || []) {
      if (request.status !== "approved") continue;
      if (
        !accessRequestMatchesVisitor(request, trimmedVisitorId, trimmedOldName)
      )
        continue;

      request.requesterName = trimmedNewName;
      request.requesterVisitorId =
        trimmedVisitorId || request.requesterVisitorId || "";
      touched = true;
      updatedRequests += 1;
    }

    if (!touched) continue;

    const currentOwnerRequest = newestConfirmedApprovedRequest(
      account.accessRequests || [],
    );
    if (
      currentOwnerRequest &&
      accessRequestMatchesVisitor(
        currentOwnerRequest,
        trimmedVisitorId,
        trimmedNewName,
      ) &&
      account.ownerIsAdmin === false
    ) {
      account.ownerName = trimmedNewName;
      updatedAccounts += 1;
    }

    await account.save();
  }

  return { updatedAccounts, updatedRequests };
}

async function findOrCreateProfile(visitorId) {
  return VisitorProfile.findOneAndUpdate(
    { visitorId },
    {
      $setOnInsert: {
        visitorId,
        displayName: "non",
        preferences: DEFAULT_PROFILE_PREFERENCES,
        seenNotifications: { user: [], admin: [] },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function getProfile(req, res, next) {
  try {
    const visitorId = getVisitorId(req, res, { createIfMissing: true });

    if (!visitorId) {
      res.status(400);
      throw new Error("Thiếu visitorId để tải hồ sơ người dùng.");
    }

    const profile = await findOrCreateProfile(visitorId);

    res.json({ success: true, data: profileResponseData(profile, visitorId) });
  } catch (error) {
    next(error);
  }
}

export async function updateProfileName(req, res, next) {
  try {
    const visitorId = getVisitorId(req);
    const newName = cleanText(req.body?.displayName || req.body?.newName)
      .replace(/\s+/g, " ")
      .slice(0, 80);

    if (!visitorId) {
      res.status(400);
      throw new Error("Thiếu visitorId để đổi tên hiển thị.");
    }

    if (!newName || sameName(newName, "non")) {
      res.status(400);
      throw new Error("Tên hiển thị mới không được để trống hoặc là non.");
    }

    if (isReservedDisplayName(newName)) {
      res.status(400);
      throw new Error(
        "Tên này được hệ thống giữ riêng, vui lòng chọn tên khác.",
      );
    }

    const profile = await findOrCreateProfile(visitorId);
    const oldName = profile.displayName || "non";

    profile.displayName = newName;
    await profile.save();

    const renameSync = await syncGrantedOwnershipForProfileRename({
      visitorId,
      oldName,
      newName,
    });

    await writeActivityLog({
      req,
      action: "visitor_profile_update",
      target: newName,
      description:
        oldName && oldName !== "non"
          ? `Đổi tên hiển thị từ ${oldName} sang ${newName}; đồng bộ ${renameSync.updatedAccounts} tài khoản đã xác nhận đăng nhập.`
          : `Đặt tên hiển thị ${newName}`,
      metadata: {
        requesterName: newName,
        requesterVisitorId: visitorId,
        oldName,
        newName,
        visitorId,
        scope: "profile_display_and_confirmed_ownership",
        ...renameSync,
      },
    });

    emitRealtimeSync("profile:name_updated", {
      visitorId,
      updatedAccounts: renameSync.updatedAccounts,
      updatedRequests: renameSync.updatedRequests,
    });

    res.json({
      success: true,
      message:
        oldName && oldName !== "non"
          ? `Đã đổi tên hiển thị từ ${oldName} sang ${newName}. Các tài khoản bạn đã bấm Done sau khi lấy OTP sẽ đổi Chủ sở hữu theo tên mới.`
          : `Đã lưu tên ${newName}.`,
      data: profileResponseData(profile, visitorId),
      rename: {
        ...renameSync,
        scope: "profile_display_and_confirmed_ownership",
      },
    });
  } catch (error) {
    if (res.statusCode === 200) res.status(400);
    next(error);
  }
}

export async function updateProfilePreferences(req, res, next) {
  try {
    const visitorId = getVisitorId(req);

    if (!visitorId) {
      res.status(400);
      throw new Error("Thiếu visitorId để lưu cài đặt.");
    }

    const profile = await findOrCreateProfile(visitorId);
    profile.preferences = normalizePreferences(
      req.body?.preferences || req.body || {},
    );
    await profile.save();

    await writeActivityLog({
      req,
      action: "preferences_update",
      target: profile.displayName || visitorId,
      description: `Cập nhật cài đặt hiển thị cho ${profile.displayName || visitorId}`,
      metadata: {
        requesterName: profile.displayName,
        requesterVisitorId: visitorId,
        visitorId,
      },
    });

    emitRealtimeSync(
      "profile:preferences_updated",
      { visitorId },
      { visitorId },
    );

    res.json({
      success: true,
      message: "Đã lưu cài đặt vào MongoDB.",
      data: profileResponseData(profile, visitorId),
    });
  } catch (error) {
    if (res.statusCode === 200) res.status(400);
    next(error);
  }
}

export async function markNotificationsSeen(req, res, next) {
  try {
    const visitorId = getVisitorId(req);
    const mode = req.body?.mode === "admin" ? "admin" : "user";
    const keys = Array.isArray(req.body?.notificationKeys)
      ? req.body.notificationKeys
          .map((key) => String(key))
          .filter(Boolean)
          .slice(0, 500)
      : [];

    if (!visitorId) {
      res.status(400);
      throw new Error("Thiếu visitorId để lưu trạng thái thông báo.");
    }

    const profile = await findOrCreateProfile(visitorId);
    profile.set(`seenNotifications.${mode}`, Array.from(new Set(keys)));
    await profile.save();

    res.json({
      success: true,
      message: "Đã đánh dấu thông báo đã xem.",
      data: profileResponseData(profile, visitorId),
    });
  } catch (error) {
    if (res.statusCode === 200) res.status(400);
    next(error);
  }
}
