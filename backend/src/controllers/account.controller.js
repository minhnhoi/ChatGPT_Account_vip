import mongoose from "mongoose";
import Account from "../models/Account.js";
import VisitorProfile from "../models/VisitorProfile.js";
import { encryptText, decryptText } from "../utils/cryptoVault.js";
import {
  clearAdminAuthCookie,
  createAdminToken,
  getAdminPasswordFromRequest,
  getAdminSessionFromRequest,
  getAdminSessionInfo,
  verifyAdminCsrf,
  verifyAdminPassword,
  setAdminAuthCookie,
} from "../utils/adminAuth.js";
import { getVisitorIdFromRequest } from "../utils/visitorSession.js";
import { getUserSessionFromRequest } from "../utils/userAuth.js";
import { writeActivityLog } from "../utils/auditLog.js";
import { emitRealtimeSync } from "../socket.js";

const UPDATABLE_FIELDS = [
  "ownerName",
  "loginEmail",
  "accountName",
  "serviceUrl",
  "planVersion",
  "status",
  "renewalDate",
  "note",
];

const STATUS_ALIASES = {
  in_use: "active",
  old: "expired",
  lost: "disabled",
};

export async function verifyAdminAccess(req, res, next) {
  try {
    const isValidAdmin = await verifyAdminPassword(
      getAdminPasswordFromRequest(req),
    );

    if (!isValidAdmin) {
      res.status(401);
      throw new Error("Mật khẩu admin không đúng");
    }

    const tokenData = createAdminToken();
    setAdminAuthCookie(res, tokenData.token, tokenData.expiresAt);

    await writeActivityLog({
      req,
      action: "admin_login",
      target: "admin",
      description: "Đăng nhập admin thành công",
    });

    res.json({
      success: true,
      message: "Đã mở khóa quyền admin bằng httpOnly cookie.",
      data: {
        role: "admin",
        csrfToken: tokenData.csrfToken,
        sessionToken: tokenData.token,
        expiresAt: tokenData.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminSession(req, res, next) {
  try {
    const session = getAdminSessionInfo(req);
    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
}

export async function logoutAdmin(req, res, next) {
  try {
    clearAdminAuthCookie(res);

    await writeActivityLog({
      req,
      action: "admin_logout",
      target: "admin",
      description: "Đăng xuất admin và xóa httpOnly cookie",
    });

    res.json({ success: true, message: "Đã đăng xuất admin." });
  } catch (error) {
    next(error);
  }
}

function normalizeStatus(status) {
  return STATUS_ALIASES[status] || status || "new";
}

function parseTags(tags) {
  if (!tags) return [];

  const source = Array.isArray(tags) ? tags : String(tags).split(",");

  return source
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .slice(0, 12);
}

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

function truncate(value, max = 120) {
  return cleanText(value).slice(0, max);
}

function getHeader(req, name, max = 120) {
  return truncate(decodeHeaderValue(req.get(name)), max);
}

function getClientIp(req) {
  const forwardedFor = String(req.get("x-forwarded-for") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)[0];
  const raw = forwardedFor || req.ip || req.socket?.remoteAddress || "";
  return truncate(raw.replace(/^::ffff:/, ""), 80);
}

function getIpPrefix(ip = "") {
  const cleanIp = String(ip || "").trim();
  if (!cleanIp) return "";

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(cleanIp)) {
    return cleanIp.split(".").slice(0, 3).join(".") + ".0/24";
  }

  if (cleanIp.includes(":")) {
    return cleanIp.split(":").filter(Boolean).slice(0, 4).join(":") + "::/64";
  }

  return cleanIp;
}

function extractClientInfo(req) {
  const ip = getClientIp(req);
  return {
    ip,
    ipPrefix: getIpPrefix(ip),
    forwardedFor: truncate(req.get("x-forwarded-for"), 240),
    userAgent: truncate(req.get("user-agent"), 360),
    fingerprint: getHeader(req, "x-client-fingerprint", 180),
    timezone: getHeader(req, "x-client-timezone", 80),
    language: truncate(
      req.get("accept-language") || req.get("x-client-language"),
      80,
    ),
    platform: getHeader(req, "x-client-platform", 80),
    screen: getHeader(req, "x-client-screen", 80),
  };
}

function uniqueNonEmpty(values = []) {
  return Array.from(
    new Set(values.map((value) => cleanText(value)).filter(Boolean)),
  );
}

async function buildClientRiskInfo(req, requesterVisitorId = "") {
  const clientInfo = extractClientInfo(req);
  const conditions = [];

  if (clientInfo.fingerprint)
    conditions.push({
      "accessRequests.clientInfo.fingerprint": clientInfo.fingerprint,
    });
  if (clientInfo.ipPrefix)
    conditions.push({
      "accessRequests.clientInfo.ipPrefix": clientInfo.ipPrefix,
    });
  if (clientInfo.userAgent)
    conditions.push({
      "accessRequests.clientInfo.userAgent": clientInfo.userAgent,
    });

  if (!conditions.length) {
    return {
      ...clientInfo,
      duplicateSignals: {},
      riskScore: 0,
      riskFlags: [],
    };
  }

  const accounts = await Account.find({ $or: conditions })
    .select(
      "accountName accessRequests.requesterName accessRequests.requesterVisitorId accessRequests.clientInfo accessRequests.status",
    )
    .lean();

  const sameFingerprintVisitors = new Set();
  const sameIpPrefixVisitors = new Set();
  const sameUserAgentVisitors = new Set();
  let sameFingerprintRequests = 0;
  let sameIpPrefixRequests = 0;

  for (const account of accounts) {
    for (const request of account.accessRequests || []) {
      const requestClient = request.clientInfo || {};
      const visitorKey =
        cleanText(request.requesterVisitorId) ||
        cleanText(request.requesterName) ||
        "unknown";
      if (!visitorKey) continue;

      if (
        clientInfo.fingerprint &&
        requestClient.fingerprint === clientInfo.fingerprint
      ) {
        sameFingerprintRequests += 1;
        sameFingerprintVisitors.add(visitorKey);
      }

      if (
        clientInfo.ipPrefix &&
        requestClient.ipPrefix === clientInfo.ipPrefix
      ) {
        sameIpPrefixRequests += 1;
        sameIpPrefixVisitors.add(visitorKey);
      }

      if (
        clientInfo.userAgent &&
        requestClient.userAgent === clientInfo.userAgent
      ) {
        sameUserAgentVisitors.add(visitorKey);
      }
    }
  }

  if (requesterVisitorId) {
    sameFingerprintVisitors.delete(requesterVisitorId);
    sameIpPrefixVisitors.delete(requesterVisitorId);
    sameUserAgentVisitors.delete(requesterVisitorId);
  }

  const duplicateSignals = {
    sameFingerprintVisitors: sameFingerprintVisitors.size,
    sameIpPrefixVisitors: sameIpPrefixVisitors.size,
    sameUserAgentVisitors: sameUserAgentVisitors.size,
    sameFingerprintRequests,
    sameIpPrefixRequests,
  };

  const riskFlags = [];
  if (sameFingerprintVisitors.size > 0)
    riskFlags.push(
      `Trùng fingerprint với ${sameFingerprintVisitors.size} hồ sơ khác`,
    );
  if (sameIpPrefixVisitors.size >= 2)
    riskFlags.push(
      `Cùng mạng/IP prefix với ${sameIpPrefixVisitors.size} hồ sơ khác`,
    );
  if (sameUserAgentVisitors.size >= 3)
    riskFlags.push(
      `Cùng trình duyệt/thiết bị với ${sameUserAgentVisitors.size} hồ sơ khác`,
    );
  if (!clientInfo.fingerprint)
    riskFlags.push("Thiếu fingerprint từ trình duyệt");

  const riskScore = Math.min(
    100,
    sameFingerprintVisitors.size * 45 +
      Math.max(0, sameIpPrefixVisitors.size - 1) * 20 +
      Math.max(0, sameUserAgentVisitors.size - 2) * 10 +
      (!clientInfo.fingerprint ? 15 : 0),
  );

  return {
    ...clientInfo,
    duplicateSignals,
    riskScore,
    riskFlags: uniqueNonEmpty(riskFlags).slice(0, 8),
  };
}

function sameName(a, b) {
  return cleanText(a).toLowerCase() === cleanText(b).toLowerCase();
}

function getAuthenticatedUserSession(req) {
  return getUserSessionFromRequest(req);
}

function getRequesterName(req) {
  const authUser = getAuthenticatedUserSession(req);
  if (authUser?.displayName)
    return cleanText(authUser.displayName).slice(0, 80);
  if (authUser?.username) return cleanText(authUser.username).slice(0, 80);
  return cleanText(
    decodeHeaderValue(req.get("x-visitor-name")) ||
      req.body?.requesterName ||
      req.query?.requesterName,
  ).slice(0, 80);
}

function getRequesterVisitorId(req, res = null, options = {}) {
  const authUser = getAuthenticatedUserSession(req);
  if (authUser?.visitorId) return cleanText(authUser.visitorId).slice(0, 120);
  return getVisitorIdFromRequest(req, res, {
    createIfMissing: Boolean(options.createIfMissing),
  });
}

function requestIsLoggedInUser(req) {
  return Boolean(getAuthenticatedUserSession(req));
}

function getDecisionReason(req, fallback = "") {
  return cleanText(
    req.body?.reason ||
      req.body?.decisionReason ||
      req.query?.reason ||
      fallback,
  )
    .replace(/\s+/g, " ")
    .slice(0, 360);
}

function requestIsAdmin(req) {
  return Boolean(getAdminSessionFromRequest(req));
}

function requestBelongsToVisitor(
  request,
  requesterName = "",
  requesterVisitorId = "",
) {
  if (!request) return false;
  if (
    requesterVisitorId &&
    request.requesterVisitorId &&
    request.requesterVisitorId === requesterVisitorId
  )
    return true;
  return requesterName && sameName(request.requesterName, requesterName);
}

function hasApprovedAccountAccess(
  account,
  requesterName,
  requesterVisitorId = "",
) {
  if (!account || (!requesterName && !requesterVisitorId)) return false;
  return (account.accessRequests || []).some(
    (request) =>
      request.status === "approved" &&
      requestBelongsToVisitor(request, requesterName, requesterVisitorId),
  );
}

function isConfirmedUserOwner(data = {}, safeAccessRequests = []) {
  return safeAccessRequests.some(
    (request) =>
      request.status === "approved" &&
      request.loginConfirmedAt &&
      sameName(request.requesterName, data.ownerName),
  );
}

function resolveOwnerIsAdminFlag(data = {}, safeAccessRequests = []) {
  if (typeof data.ownerIsAdmin === "boolean") return data.ownerIsAdmin;

  return !isConfirmedUserOwner(data, safeAccessRequests);
}

function sanitizeAccessRequests(account) {
  return (account.accessRequests || []).map((request) => ({
    _id: request._id,
    requesterName: request.requesterName,
    status: request.status,
    requestedAt: request.requestedAt,
    decidedAt: request.decidedAt,
    decidedBy: request.decidedBy,
    decisionReason: request.decisionReason || "",
    loginConfirmedAt: request.loginConfirmedAt || null,
    requesterVisitorId: request.requesterVisitorId || "",
    clientInfo: request.clientInfo || {},
    hiddenFromAdmin: Boolean(request.hiddenFromAdmin),
  }));
}

async function resolveCurrentRequesterName(request) {
  const fallbackName = cleanText(request?.requesterName);
  const requesterVisitorId = cleanText(request?.requesterVisitorId);

  if (!requesterVisitorId) return fallbackName;

  const profile = await VisitorProfile.findOne({
    visitorId: requesterVisitorId,
  }).lean();
  const displayName = cleanText(profile?.displayName);

  if (displayName && !sameName(displayName, "non")) return displayName;
  return fallbackName;
}

function maskLoginEmail(login = "") {
  const value = cleanText(login).toLowerCase();
  if (!value) return "";
  const [local, domain] = value.includes("@")
    ? value.split(/@(.+)/)
    : [value, ""];
  const keepCount = Math.max(1, Math.ceil(local.length / 2));
  const maskCount = Math.max(1, local.length - keepCount);
  const maskedLocal = `${"*".repeat(maskCount)}${local.slice(maskCount)}`;
  return domain ? `${maskedLocal}@${domain}` : maskedLocal;
}

function sanitizeAccountForList(
  account,
  { isAdmin = false, requesterName = "", requesterVisitorId = "" } = {},
) {
  const data = account?.toJSON ? account.toJSON() : { ...(account || {}) };
  delete data.passwordEncrypted;
  data.passwordMasked = "••••••••";

  const safeAccessRequests = sanitizeAccessRequests(data);
  data.ownerIsAdmin = resolveOwnerIsAdminFlag(data, safeAccessRequests);
  data.ownerRole = data.ownerIsAdmin ? "admin" : "user";
  data.accessRequests = isAdmin
    ? safeAccessRequests
    : safeAccessRequests.filter((request) =>
        requestBelongsToVisitor(request, requesterName, requesterVisitorId),
      );

  data.loginEmailMasked = maskLoginEmail(data.loginEmail);
  if (!isAdmin) data.loginEmail = data.loginEmailMasked;

  return data;
}

function buildFilters(query) {
  const { search = "", status = "all", planVersion = "all" } = query;
  const filter = {};

  if (status !== "all") {
    const statusAliases = {
      active: ["active", "in_use"],
      expired: ["expired", "old"],
      disabled: ["disabled", "lost"],
    };
    filter.status = statusAliases[status]
      ? { $in: statusAliases[status] }
      : status;
  }

  if (planVersion !== "all") filter.planVersion = planVersion;

  const trimmed = String(search || "").trim();
  if (trimmed) {
    const safe = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { ownerName: { $regex: safe, $options: "i" } },
      { loginEmail: { $regex: safe, $options: "i" } },
      { accountName: { $regex: safe, $options: "i" } },
      { note: { $regex: safe, $options: "i" } },
      { tags: { $regex: safe, $options: "i" } },
    ];
  }

  return filter;
}

function reduceAggregation(rows, normalizer = (value) => value || "other") {
  return rows.reduce((result, item) => {
    const key = normalizer(item._id);
    result[key] = (result[key] || 0) + item.count;
    return result;
  }, {});
}

export async function getAccounts(req, res, next) {
  try {
    const filter = buildFilters(req.query);
    const accounts = await Account.find(filter).sort({
      updatedAt: -1,
      createdAt: -1,
    });
    const isAdmin = requestIsAdmin(req);
    const requesterName = getRequesterName(req);
    const requesterVisitorId = getRequesterVisitorId(req);
    const data = accounts.map((account) =>
      sanitizeAccountForList(account, {
        isAdmin,
        requesterName,
        requesterVisitorId,
      }),
    );

    res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function getStats(req, res, next) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      total,
      byStatusRaw,
      byPlanRaw,
      createdThisMonth,
      paidAccounts,
      needsAttention,
      upcomingRenewals,
      activeAccounts,
      newAccounts,
      pendingAccessRequests,
    ] = await Promise.all([
      Account.countDocuments(),
      Account.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Account.aggregate([
        { $group: { _id: "$planVersion", count: { $sum: 1 } } },
      ]),
      Account.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Account.countDocuments({
        planVersion: { $in: ["plus", "pro", "team", "enterprise"] },
      }),
      Account.countDocuments({
        status: { $in: ["expired", "disabled", "lost", "old"] },
      }),
      Account.countDocuments({ renewalDate: { $gte: now, $lte: in30Days } }),
      Account.countDocuments({ status: { $in: ["active", "in_use"] } }),
      Account.countDocuments({ status: "new" }),
      Account.countDocuments({ "accessRequests.status": "pending" }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        createdThisMonth,
        paidAccounts,
        needsAttention,
        upcomingRenewals,
        activeAccounts,
        newAccounts,
        pendingAccessRequests,
        byStatus: reduceAggregation(byStatusRaw, normalizeStatus),
        byPlan: reduceAggregation(byPlanRaw),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createAccount(req, res, next) {
  try {
    const body = req.body || {};
    const {
      ownerName,
      loginEmail,
      password,
      accountName,
      serviceUrl = "",
      planVersion = "free",
      status = "new",
      renewalDate,
      tags,
      note = "",
    } = body;

    const owner = cleanText(
      ownerName || body.owner || body.name || body.fullName,
    );
    const email = cleanText(
      loginEmail || body.email || body.username,
    ).toLowerCase();
    const name = cleanText(
      accountName || body.serviceName || body.accountTitle,
    );
    const link = cleanText(
      serviceUrl || body.url || body.link || body.openUrl,
    ).slice(0, 500);
    const plainPassword = cleanText(password || body.accountPassword);

    if (!owner) {
      res.status(400);
      throw new Error("Tên chủ sở hữu là bắt buộc");
    }

    if (!email) {
      res.status(400);
      throw new Error("Email hoặc tên đăng nhập là bắt buộc");
    }

    if (!name) {
      res.status(400);
      throw new Error("Tên tài khoản là bắt buộc");
    }

    if (!plainPassword) {
      res.status(400);
      throw new Error("Mật khẩu là bắt buộc");
    }

    const account = await Account.create({
      ownerName: owner,
      ownerIsAdmin: true,
      ownerOriginalIsAdmin: true,
      loginEmail: email,
      passwordEncrypted: encryptText(plainPassword),
      accountName: name,
      serviceUrl: link,
      planVersion,
      status,
      renewalDate: renewalDate || null,
      tags: parseTags(tags),
      note: cleanText(note),
    });

    await writeActivityLog({
      req,
      action: "account_create",
      target: account.accountName,
      targetId: account._id,
      description: `Thêm tài khoản ${account.accountName}`,
      metadata: { planVersion: account.planVersion, status: account.status },
    });

    emitRealtimeSync("account:created", {
      accountId: account._id,
      accountName: account.accountName,
    });

    res.status(201).json({
      success: true,
      message: "Đã thêm tài khoản",
      data: account,
    });
  } catch (error) {
    if (res.statusCode === 200) res.status(400);
    next(error);
  }
}

export async function updateAccount(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("ID không hợp lệ");
    }

    const account = await Account.findById(id);

    if (!account) {
      res.status(404);
      throw new Error("Không tìm thấy tài khoản");
    }

    const isAdmin = requestIsAdmin(req);
    const requesterName = getRequesterName(req);
    const requesterVisitorId = getRequesterVisitorId(req);
    const hasAccountAccess = hasApprovedAccountAccess(
      account,
      requesterName,
      requesterVisitorId,
    );

    if (!isAdmin && !requestIsLoggedInUser(req)) {
      res.status(401);
      throw new Error(
        "Bạn cần đăng nhập tài khoản để sửa trạng thái hoặc thao tác người dùng.",
      );
    }

    if (!isAdmin && !hasAccountAccess) {
      res.status(403);
      throw new Error("Bạn chưa được admin cấp quyền cho tài khoản này.");
    }

    if (isAdmin && !verifyAdminCsrf(req)) {
      res.status(403);
      throw new Error(
        "Phiên admin thiếu CSRF token hợp lệ. Hãy tải lại web hoặc đăng nhập lại admin.",
      );
    }

    if (!isAdmin) {
      if (!Object.prototype.hasOwnProperty.call(req.body || {}, "status")) {
        res.status(400);
        throw new Error(
          "Quyền được cấp chỉ cho phép sửa trạng thái tài khoản.",
        );
      }

      account.status = normalizeStatus(req.body.status);
      await account.save();

      await writeActivityLog({
        req,
        action: "account_status_update_granted",
        target: account.accountName,
        targetId: account._id,
        description: `${requesterName} cập nhật trạng thái của ${account.accountName}`,
        metadata: { status: account.status, requesterName, requesterVisitorId },
      });

      emitRealtimeSync("account:status_updated", {
        accountId: account._id,
        accountName: account.accountName,
        status: account.status,
      });

      return res.json({
        success: true,
        message: "Đã cập nhật trạng thái tài khoản",
        data: account,
      });
    }

    const updateData = {};

    UPDATABLE_FIELDS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
        updateData[field] =
          typeof req.body[field] === "string"
            ? req.body[field].trim()
            : req.body[field];
      }
    });

    if (updateData.loginEmail)
      updateData.loginEmail = updateData.loginEmail.toLowerCase();

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "tags")) {
      updateData.tags = parseTags(req.body.tags);
    }

    if (req.body?.password && String(req.body.password).trim()) {
      updateData.passwordEncrypted = encryptText(
        String(req.body.password).trim(),
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(req.body || {}, "renewalDate") &&
      !req.body.renewalDate
    ) {
      updateData.renewalDate = null;
    }

    Object.assign(account, updateData);
    await account.save();

    await writeActivityLog({
      req,
      action: "account_update",
      target: account.accountName,
      targetId: account._id,
      description: `Cập nhật tài khoản ${account.accountName}`,
      metadata: { fields: Object.keys(updateData) },
    });

    emitRealtimeSync("account:updated", {
      accountId: account._id,
      accountName: account.accountName,
      fields: Object.keys(updateData),
    });

    res.json({
      success: true,
      message: "Đã cập nhật tài khoản",
      data: account,
    });
  } catch (error) {
    if (res.statusCode === 200) res.status(400);
    next(error);
  }
}

export async function deleteAccount(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("ID không hợp lệ");
    }

    const account = await Account.findByIdAndDelete(id);

    if (!account) {
      res.status(404);
      throw new Error("Không tìm thấy tài khoản");
    }

    await writeActivityLog({
      req,
      action: "account_delete",
      target: account.accountName,
      targetId: account._id,
      description: `Xóa tài khoản ${account.accountName}`,
    });

    emitRealtimeSync("account:deleted", {
      accountId: account._id,
      accountName: account.accountName,
    });

    res.json({
      success: true,
      message: "Đã xóa tài khoản",
    });
  } catch (error) {
    next(error);
  }
}

export async function revealPassword(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("ID không hợp lệ");
    }

    const account = await Account.findById(id).select(
      "passwordEncrypted accountName loginEmail accessRequests",
    );

    if (!account) {
      res.status(404);
      throw new Error("Không tìm thấy tài khoản");
    }

    const isAdmin = requestIsAdmin(req);
    const requesterName = getRequesterName(req);

    const requesterVisitorId = getRequesterVisitorId(req);

    if (!isAdmin && !requestIsLoggedInUser(req)) {
      res.status(401);
      throw new Error(
        "Bạn cần đăng nhập tài khoản để xem email/mật khẩu hoặc lấy OTP.",
      );
    }

    if (
      !isAdmin &&
      !hasApprovedAccountAccess(account, requesterName, requesterVisitorId)
    ) {
      res.status(403);
      throw new Error(
        "Bạn chưa được admin cấp quyền xem tài khoản/mật khẩu này.",
      );
    }

    if (isAdmin && !verifyAdminCsrf(req)) {
      res.status(403);
      throw new Error(
        "Phiên admin thiếu CSRF token hợp lệ. Hãy tải lại web hoặc đăng nhập lại admin.",
      );
    }

    if (requesterVisitorId) {
      await VisitorProfile.findOneAndUpdate(
        { visitorId: requesterVisitorId },
        {
          $setOnInsert: {
            visitorId: requesterVisitorId,
            displayName: requesterName || "non",
          },
          $set: {
            "otpBinding.accountId": account._id,
            "otpBinding.accountName": account.accountName || "",
            "otpBinding.loginEmail": account.loginEmail || "",
            "otpBinding.assignedAt": new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    await writeActivityLog({
      req,
      action: "password_reveal",
      target: account.accountName,
      targetId: account._id,
      description: `${isAdmin ? "Admin" : requesterName} xem mật khẩu của ${account.accountName}`,
      metadata: {
        requesterName: isAdmin ? "admin" : requesterName,
        requesterVisitorId: isAdmin ? requesterVisitorId : requesterVisitorId,
        otpBinding: account.loginEmail,
      },
    });

    res.json({
      success: true,
      data: {
        accountName: account.accountName,
        loginEmail: account.loginEmail,
        password: decryptText(account.passwordEncrypted),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function renameVisitorName(req, res, next) {
  try {
    const oldName = cleanText(
      req.body?.oldName ||
        decodeHeaderValue(req.get("x-visitor-name")) ||
        req.query?.oldName,
    ).slice(0, 80);
    const newName = cleanText(
      req.body?.newName || req.body?.displayName || req.query?.newName,
    )
      .replace(/\s+/g, " ")
      .slice(0, 80);

    if (!newName) {
      res.status(400);
      throw new Error("Tên hiển thị mới không được để trống.");
    }

    await writeActivityLog({
      req,
      action: "visitor_rename_display_only",
      target: newName,
      description:
        oldName && !sameName(oldName, newName)
          ? `Đổi tên hiển thị giao diện từ ${oldName} sang ${newName}`
          : `Cập nhật tên hiển thị ${newName}`,
      metadata: {
        requesterName: newName,
        oldName,
        newName,
        scope: "profile_display_only",
      },
    });

    res.json({
      success: true,
      message:
        "Đã đổi tên hiển thị. Tài khoản, quyền truy cập và chủ sở hữu cũ không bị đổi hàng loạt.",
      data: {
        oldName,
        newName,
        updatedAccounts: 0,
        updatedRequests: 0,
        scope: "profile_display_only",
      },
    });
  } catch (error) {
    if (res.statusCode === 200) res.status(400);
    next(error);
  }
}

export async function requestAccountAccess(req, res, next) {
  try {
    const { id } = req.params;
    const requesterName = getRequesterName(req);
    const requesterVisitorId = getRequesterVisitorId(req, res, {
      createIfMissing: true,
    });

    if (!requestIsLoggedInUser(req)) {
      res.status(401);
      throw new Error(
        "Khách chỉ được xem danh sách. Hãy đăng nhập/đăng ký tài khoản để xin quyền sử dụng.",
      );
    }

    const clientInfo = await buildClientRiskInfo(req, requesterVisitorId);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("ID không hợp lệ");
    }

    if (!requesterName) {
      res.status(400);
      throw new Error("Bạn cần nhập tên trước khi xin quyền.");
    }

    const account = await Account.findById(id);

    if (!account) {
      res.status(404);
      throw new Error("Không tìm thấy tài khoản");
    }

    const activeRequest = account.accessRequests.find(
      (request) =>
        requestBelongsToVisitor(request, requesterName, requesterVisitorId) &&
        ["pending", "approved"].includes(request.status),
    );

    if (activeRequest) {
      if (activeRequest.status === "pending") {
        activeRequest.requesterName = requesterName;
        activeRequest.requesterVisitorId =
          requesterVisitorId || activeRequest.requesterVisitorId || "";
        activeRequest.clientInfo = clientInfo;
        await account.save();
        emitRealtimeSync("access:request_updated", {
          accountId: account._id,
          accountName: account.accountName,
          requesterVisitorId,
        });
      }
      const message =
        activeRequest.status === "approved"
          ? "Bạn đã được cấp quyền tài khoản này."
          : "Yêu cầu đang chờ admin duyệt.";
      return res.json({
        success: true,
        message,
        data: account,
        request: activeRequest,
      });
    }

    const oldRequest = account.accessRequests.find((request) =>
      requestBelongsToVisitor(request, requesterName, requesterVisitorId),
    );
    if (oldRequest) {
      oldRequest.requesterName = requesterName;
      oldRequest.requesterVisitorId =
        requesterVisitorId || oldRequest.requesterVisitorId || "";
      oldRequest.status = "pending";
      oldRequest.requestedAt = new Date();
      oldRequest.decidedAt = null;
      oldRequest.decidedBy = "";
      oldRequest.decisionReason = "";
      oldRequest.clientInfo = clientInfo;
      oldRequest.hiddenFromAdmin = false;
    } else {
      account.accessRequests.push({
        requesterName,
        requesterVisitorId,
        status: "pending",
        clientInfo,
        hiddenFromAdmin: false,
      });
    }

    await account.save();

    await writeActivityLog({
      req,
      action: "access_request",
      target: account.accountName,
      targetId: account._id,
      description: `${requesterName} xin quyền truy cập ${account.accountName}`,
      metadata: { requesterName, requesterVisitorId, clientInfo },
    });

    emitRealtimeSync("access:requested", {
      accountId: account._id,
      accountName: account.accountName,
      requesterVisitorId,
    });

    res.status(201).json({
      success: true,
      message: "Đã gửi yêu cầu. Chờ admin cấp quyền trong mục Quản lý Admin.",
      data: account,
      accessRequests: sanitizeAccessRequests(account),
    });
  } catch (error) {
    next(error);
  }
}

function releaseOwnershipAfterAccessChange(
  account,
  request,
  previousStatus,
  nextStatus,
) {
  const shouldReleaseOwnership =
    previousStatus === "approved" &&
    ["rejected", "revoked"].includes(nextStatus);

  if (!shouldReleaseOwnership) return;

  account.ownerName = account.ownerOriginalName || account.ownerName;
  account.ownerIsAdmin = true;
  account.ownerOriginalIsAdmin = true;
  account.ownerOriginalName = "";
  if (request) request.loginConfirmedAt = null;
}

async function updateAccessRequest(req, res, next, nextStatus) {
  try {
    const { id, requestId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(requestId)
    ) {
      res.status(400);
      throw new Error("ID không hợp lệ");
    }

    const account = await Account.findById(id);

    if (!account) {
      res.status(404);
      throw new Error("Không tìm thấy tài khoản");
    }

    const request = account.accessRequests.id(requestId);

    if (!request) {
      res.status(404);
      throw new Error("Không tìm thấy yêu cầu quyền");
    }

    const ownerBefore = account.ownerName;
    const previousStatus = request.status;
    const decisionReason =
      nextStatus === "revoked"
        ? getDecisionReason(req, "Admin thu hồi quyền truy cập.")
        : nextStatus === "rejected"
          ? getDecisionReason(req, "Admin từ chối quyền truy cập.")
          : "";

    request.status = nextStatus;
    request.decidedAt = new Date();
    request.decidedBy = "admin";
    request.decisionReason = ["rejected", "revoked"].includes(nextStatus)
      ? decisionReason
      : "";

    request.hiddenFromAdmin = false;

    if (nextStatus === "approved") {
      const approvedOwnerName = await resolveCurrentRequesterName(request);
      if (approvedOwnerName) request.requesterName = approvedOwnerName;

      if (!account.ownerOriginalName) {
        account.ownerOriginalName = account.ownerName;
        account.ownerOriginalIsAdmin = true;
      }
      account.ownerIsAdmin = true;
      request.loginConfirmedAt = null;
      request.decisionReason = "";
    }

    releaseOwnershipAfterAccessChange(
      account,
      request,
      previousStatus,
      nextStatus,
    );

    await account.save();

    const labels = {
      approved: "cấp quyền",
      rejected: "từ chối quyền",
      revoked: "thu hồi quyền",
    };

    await writeActivityLog({
      req,
      action: `access_${nextStatus}`,
      target: account.accountName,
      targetId: account._id,
      description: `Admin ${labels[nextStatus] || "cập nhật quyền"} ${request.requesterName} cho ${account.accountName}`,
      metadata: {
        requesterName: request.requesterName,
        requesterVisitorId: request.requesterVisitorId || "",
        status: nextStatus,
        ownerBefore,
        ownerAfter: account.ownerName,
        ownerOriginalName: account.ownerOriginalName || ownerBefore,
        decisionReason: request.decisionReason || "",
        clientInfo: request.clientInfo || {},
      },
    });

    emitRealtimeSync(`access:${nextStatus}`, {
      accountId: account._id,
      accountName: account.accountName,
      requesterVisitorId: request.requesterVisitorId || "",
      status: nextStatus,
    });

    res.json({
      success: true,
      message: `Đã ${labels[nextStatus] || "cập nhật"} cho ${request.requesterName}.`,
      data: account,
      accessRequests: sanitizeAccessRequests(account),
    });
  } catch (error) {
    next(error);
  }
}

export function approveAccountAccess(req, res, next) {
  return updateAccessRequest(req, res, next, "approved");
}

export function rejectAccountAccess(req, res, next) {
  return updateAccessRequest(req, res, next, "rejected");
}

export function revokeAccountAccess(req, res, next) {
  return updateAccessRequest(req, res, next, "revoked");
}

export async function deleteAccountAccess(req, res, next) {
  try {
    const { id, requestId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(requestId)
    ) {
      res.status(400);
      throw new Error("ID không hợp lệ");
    }

    const account = await Account.findById(id);

    if (!account) {
      res.status(404);
      throw new Error("Không tìm thấy tài khoản");
    }

    const request = account.accessRequests.id(requestId);

    if (!request) {
      res.status(404);
      throw new Error("Không tìm thấy yêu cầu quyền");
    }

    const ownerBefore = account.ownerName;
    const previousStatus = request.status;
    const decisionReason = getDecisionReason(
      req,
      "Admin xóa yêu cầu khỏi danh sách quản lý quyền.",
    );

    request.status = "rejected";
    request.decidedAt = new Date();
    request.decidedBy = "admin";
    request.decisionReason = decisionReason;
    request.hiddenFromAdmin = true;

    releaseOwnershipAfterAccessChange(
      account,
      request,
      previousStatus,
      "rejected",
    );

    await account.save();

    await writeActivityLog({
      req,
      action: "access_deleted",
      target: account.accountName,
      targetId: account._id,
      description: `Admin xóa ${request.requesterName} khỏi danh sách quyền của ${account.accountName} và gửi thông báo từ chối`,
      metadata: {
        requesterName: request.requesterName,
        requesterVisitorId: request.requesterVisitorId || "",
        status: "rejected",
        hiddenFromAdmin: true,
        decisionReason,
        clientInfo: request.clientInfo || {},
        ownerBefore,
        ownerAfter: account.ownerName,
      },
    });

    emitRealtimeSync("access:deleted", {
      accountId: account._id,
      accountName: account.accountName,
      requesterVisitorId: request.requesterVisitorId || "",
      status: "rejected",
    });

    res.json({
      success: true,
      message: `Đã xóa ${request.requesterName} khỏi danh sách và gửi thông báo từ chối quyền.`,
      data: account,
      accessRequests: sanitizeAccessRequests(account),
    });
  } catch (error) {
    next(error);
  }
}
