import mongoose from "mongoose";
import Account from "../models/Account.js";
import MailConfig from "../models/MailConfig.js";
import OtpLog from "../models/OtpLog.js";
import OtpScanCooldown from "../models/OtpScanCooldown.js";
import VisitorProfile, {
  DEFAULT_PROFILE_PREFERENCES,
} from "../models/VisitorProfile.js";
import { decryptText, encryptText } from "../utils/cryptoVault.js";
import {
  getAdminSessionFromRequest,
  verifyAdminCsrf,
} from "../utils/adminAuth.js";
import { getVisitorIdFromRequest } from "../utils/visitorSession.js";
import { getUserSessionFromRequest } from "../utils/userAuth.js";
import { writeActivityLog } from "../utils/auditLog.js";
import {
  findOtpFromMailbox,
  getConfiguredSenderEmails,
  testImapConnection,
} from "../services/imapOtp.js";
import { env } from "../config/env.js";
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

function normalizeMailList(value) {
  const raw = Array.isArray(value) ? value.join(",") : String(value || "");
  return Array.from(
    new Set(
      raw
        .split(/[;,\n]+/)
        .map((item) => cleanText(item).toLowerCase())
        .filter(Boolean),
    ),
  );
}

function senderLabelFromConfig(config) {
  return getConfiguredSenderEmails(config).join(", ");
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

function safeMailConfig(config) {
  if (!config) return null;
  if (typeof config.toSafeJSON === "function") return config.toSafeJSON();
  const doc = { ...config };
  delete doc.appPasswordEncrypted;
  doc.hasAppPassword = Boolean(config.appPasswordEncrypted);
  return doc;
}

async function getConfigDocument() {
  return MailConfig.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

function configWithPassword(config) {
  const safe = config.toObject ? config.toObject() : { ...config };
  safe.appPassword = config.appPasswordEncrypted
    ? decryptText(config.appPasswordEncrypted)
    : "";
  delete safe.appPasswordEncrypted;
  return safe;
}

async function bindOtpAccountForVisitor({
  visitorId,
  account,
  requesterName = "",
}) {
  if (!visitorId || !account?._id) return null;

  return VisitorProfile.findOneAndUpdate(
    { visitorId },
    {
      $setOnInsert: {
        visitorId,
        displayName: requesterName || "non",
        preferences: DEFAULT_PROFILE_PREFERENCES,
        seenNotifications: { user: [], admin: [] },
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

async function resolveCurrentDisplayName(visitorId = "", fallbackName = "") {
  const cleanVisitorId = cleanText(visitorId);
  if (!cleanVisitorId) return cleanText(fallbackName);

  const profile = await VisitorProfile.findOne({
    visitorId: cleanVisitorId,
  }).lean();
  const displayName = cleanText(profile?.displayName);
  if (displayName && !sameName(displayName, "non")) return displayName;
  return cleanText(fallbackName);
}

function otpCooldownSeconds() {
  return Math.min(3600, Math.max(5, Number(env.otpScanCooldownSeconds || 45)));
}

function secondsUntil(dateValue) {
  if (!dateValue) return 0;
  return Math.max(
    0,
    Math.ceil((new Date(dateValue).getTime() - Date.now()) / 1000),
  );
}

function makeCooldownKey(req, requesterVisitorId = "", isAdmin = false) {
  const visitorId = cleanText(requesterVisitorId);
  if (visitorId) return isAdmin ? `admin:${visitorId}` : visitorId;
  return `${isAdmin ? "admin-ip" : "ip"}:${req.ip || req.socket?.remoteAddress || "unknown"}`.slice(
    0,
    160,
  );
}

async function checkOtpScanCooldown({
  req,
  account,
  requesterName = "",
  requesterVisitorId = "",
  isAdmin = false,
  baseLog = null,
}) {
  const visitorId = makeCooldownKey(req, requesterVisitorId, isAdmin);
  const now = new Date();
  const existing = await OtpScanCooldown.findOne({
    visitorId,
    accountId: account._id,
  }).lean();
  const remainingSeconds = secondsUntil(existing?.nextAllowedAt);

  if (remainingSeconds > 0) {
    const message = `Bạn vừa quét OTP cho tài khoản này. Hãy chờ ${remainingSeconds}s rồi thử lại để tránh spam mailbox.`;
    if (baseLog) {
      await writeOtpLog({
        ...baseLog,
        status: "cooldown",
        message,
      });
    }
    const error = new Error(message);
    error.statusCode = 429;
    error.cooldownRemainingSeconds = remainingSeconds;
    error.cooldownAvailableAt = existing.nextAllowedAt;
    throw error;
  }

  const cooldown = otpCooldownSeconds();
  const nextAllowedAt = new Date(now.getTime() + cooldown * 1000);

  await OtpScanCooldown.findOneAndUpdate(
    { visitorId, accountId: account._id },
    {
      $set: {
        visitorId,
        requesterName: cleanText(isAdmin ? "admin" : requesterName).slice(
          0,
          80,
        ),
        requestedByRole: isAdmin ? "admin" : "user",
        accountId: account._id,
        accountName: account.accountName || "",
        loginEmail: account.loginEmail || "",
        lastScanAt: now,
        nextAllowedAt,
        cooldownSeconds: cooldown,
        lastResultStatus: "started",
        lastMessage: `Đã bắt đầu quét OTP cho ${account.loginEmail || account.accountName || "tài khoản"}.`,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return {
    visitorId,
    accountId: account._id,
    cooldownSeconds: cooldown,
    cooldownRemainingSeconds: cooldown,
    cooldownAvailableAt: nextAllowedAt,
  };
}

async function markOtpScanCooldownResult(
  cooldownState,
  status = "unknown",
  message = "",
) {
  if (!cooldownState?.visitorId || !cooldownState?.accountId) return;
  await OtpScanCooldown.findOneAndUpdate(
    { visitorId: cooldownState.visitorId, accountId: cooldownState.accountId },
    {
      $set: {
        lastResultStatus: String(status).slice(0, 40),
        lastMessage: String(message || "").slice(0, 240),
      },
    },
  );
}

function attachCooldownToError(error, cooldownState) {
  if (!error || !cooldownState) return error;
  error.cooldownRemainingSeconds =
    secondsUntil(cooldownState.cooldownAvailableAt) ||
    cooldownState.cooldownRemainingSeconds ||
    cooldownState.cooldownSeconds ||
    0;
  error.cooldownAvailableAt = cooldownState.cooldownAvailableAt;
  return error;
}

async function writeOtpLog(data) {
  return OtpLog.create({
    accountId: data.accountId || null,
    accountName: data.accountName || "",
    loginEmail: data.loginEmail || "",
    recipientEmail: data.recipientEmail || data.loginEmail || "",
    requesterName: data.requesterName || "",
    requesterVisitorId: data.requesterVisitorId || "",
    requestedByRole: data.requestedByRole || "user",
    otpCode: data.otpCode || "",
    senderEmail: data.senderEmail || "",
    subject: data.subject || "",
    receivedAt: data.receivedAt || null,
    messageUid: data.messageUid || "",
    status: data.status || "success",
    message: data.message || "",
    loginResult:
      data.loginResult || (data.status === "success" ? "pending" : ""),
    loginConfirmedAt: data.loginConfirmedAt || null,
  });
}

export async function getMailConfig(req, res, next) {
  try {
    const config = await getConfigDocument();
    res.json({ success: true, data: safeMailConfig(config) });
  } catch (error) {
    next(error);
  }
}

export async function saveMailConfig(req, res, next) {
  try {
    const config = await getConfigDocument();
    const body = req.body || {};

    const imapEmail = cleanText(body.imapEmail || body.email).toLowerCase();
    const appPassword = cleanText(body.appPassword || body.password);

    if (!imapEmail) {
      res.status(400);
      throw new Error("Email IMAP là bắt buộc.");
    }

    config.imapEmail = imapEmail;
    config.imapHost = cleanText(
      body.imapHost || body.host || config.imapHost || "imap.gmail.com",
    );
    config.imapPort = Math.min(
      65535,
      Math.max(1, Number(body.imapPort || body.port || config.imapPort || 993)),
    );
    config.useTLS = body.useTLS !== false;
    const senderEmails = normalizeMailList(
      body.senderEmails ||
        body.senderEmail ||
        config.senderEmails ||
        config.senderEmail,
    );
    config.senderEmails = senderEmails.length
      ? senderEmails
      : ["noreply@tm.openai.com", "noreply@tm1.openai.com"];
    config.senderEmail = config.senderEmails[0] || "noreply@tm.openai.com";
    config.mailbox = cleanText(body.mailbox || config.mailbox || "INBOX");
    config.searchDays = Math.min(
      365,
      Math.max(1, Number(body.searchDays || config.searchDays || 30)),
    );
    config.fetchLimit = Math.min(
      1000,
      Math.max(20, Number(body.fetchLimit || config.fetchLimit || 300)),
    );
    config.enabled = Boolean(body.enabled);

    if (appPassword) {
      config.appPasswordEncrypted = encryptText(appPassword);
    } else if (!config.appPasswordEncrypted) {
      res.status(400);
      throw new Error("Mã ứng dụng của mail là bắt buộc khi cấu hình lần đầu.");
    }

    await config.save();

    await writeActivityLog({
      req,
      action: "otp_mail_config_update",
      target: "mail-config",
      description: `Cập nhật cấu hình lấy OTP cho ${config.imapEmail}`,
      metadata: {
        imapEmail: config.imapEmail,
        senderEmails: getConfiguredSenderEmails(config),
        enabled: config.enabled,
      },
    });

    emitRealtimeSync(
      "otp:config_updated",
      { enabled: config.enabled },
      { adminOnly: true },
    );

    res.json({
      success: true,
      message: "Đã lưu cấu hình mail vào MongoDB.",
      data: safeMailConfig(config),
    });
  } catch (error) {
    if (res.statusCode === 200) res.status(400);
    next(error);
  }
}

export async function testMailConfig(req, res, next) {
  try {
    const config = await getConfigDocument();

    if (!config.enabled) {
      res.status(400);
      throw new Error(
        "Cấu hình mail đang tắt. Hãy bật Enabled trước khi test.",
      );
    }

    const result = await testImapConnection(configWithPassword(config));
    config.lastTestAt = new Date();
    config.lastTestStatus = result.message;
    await config.save();

    await writeActivityLog({
      req,
      action: "otp_mail_test",
      target: "mail-config",
      description: `Test kết nối IMAP thành công cho ${config.imapEmail}`,
      metadata: { imapEmail: config.imapEmail },
    });

    emitRealtimeSync("otp:config_tested", { ok: true }, { adminOnly: true });

    res.json({
      success: true,
      message: result.message,
      data: safeMailConfig(config),
    });
  } catch (error) {
    try {
      const config = await getConfigDocument();
      config.lastTestAt = new Date();
      config.lastTestStatus = error.message || "Test lỗi";
      await config.save();
    } catch {}
    if (res.statusCode === 200) res.status(400);
    next(error);
  }
}

export async function getOtpLogs(req, res, next) {
  try {
    const isAdmin = requestIsAdmin(req);
    const requesterName = getRequesterName(req);
    const requesterVisitorId = getRequesterVisitorId(req);
    const limit = Math.min(500, Math.max(20, Number(req.query?.limit || 180)));

    const filter = {};
    if (!isAdmin) {
      const orConditions = [];
      if (requesterVisitorId)
        orConditions.push({ requesterVisitorId: requesterVisitorId });
      if (requesterName) orConditions.push({ requesterName: requesterName });
      if (orConditions.length) filter.$or = orConditions;
      else filter._id = null;
    }

    const logs = await OtpLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    next(error);
  }
}

export async function getOtpForAccount(req, res, next) {
  try {
    const { id } = req.params;
    const isAdmin = requestIsAdmin(req);
    const requesterName = getRequesterName(req);
    const requesterVisitorId = getRequesterVisitorId(req);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("ID tài khoản không hợp lệ.");
    }

    const account = await Account.findById(id).select(
      "accountName loginEmail accessRequests ownerName",
    );
    if (!account) {
      res.status(404);
      throw new Error("Không tìm thấy tài khoản để lấy OTP.");
    }

    if (!isAdmin && !requestIsLoggedInUser(req)) {
      res.status(401);
      throw new Error("Bạn cần đăng nhập tài khoản để lấy OTP.");
    }

    if (
      !isAdmin &&
      !hasApprovedAccountAccess(account, requesterName, requesterVisitorId)
    ) {
      res.status(403);
      throw new Error(
        "Bạn chưa được admin cấp quyền lấy OTP cho tài khoản này.",
      );
    }

    if (isAdmin && !verifyAdminCsrf(req)) {
      res.status(403);
      throw new Error(
        "Phiên admin thiếu CSRF token hợp lệ. Hãy tải lại web hoặc đăng nhập lại admin.",
      );
    }

    await bindOtpAccountForVisitor({
      visitorId: requesterVisitorId,
      requesterName,
      account,
    });

    const config = await getConfigDocument();
    const baseLog = {
      accountId: account._id,
      accountName: account.accountName,
      loginEmail: account.loginEmail,
      recipientEmail: account.loginEmail,
      requesterName: isAdmin ? "admin" : requesterName,
      requesterVisitorId: isAdmin ? requesterVisitorId : requesterVisitorId,
      requestedByRole: isAdmin ? "admin" : "user",
      senderEmail: senderLabelFromConfig(config),
    };

    if (!config.enabled || !config.imapEmail || !config.appPasswordEncrypted) {
      await writeOtpLog({
        ...baseLog,
        status: "config_missing",
        message: "Admin chưa cấu hình mail IMAP để lấy OTP.",
      });
      emitRealtimeSync("otp:log_created", {
        accountId: account._id,
        accountName: account.accountName,
        status: "config_missing",
        requesterVisitorId,
      });
      res.status(400);
      throw new Error("Admin chưa cấu hình mail IMAP để lấy OTP.");
    }

    const cooldownState = await checkOtpScanCooldown({
      req,
      account,
      requesterName,
      requesterVisitorId,
      isAdmin,
      baseLog,
    });

    let result;
    try {
      result = await findOtpFromMailbox(
        configWithPassword(config),
        account.loginEmail,
      );
    } catch (mailError) {
      const message = mailError.message || "Lỗi lấy OTP từ mailbox.";
      await markOtpScanCooldownResult(cooldownState, "error", message);
      await writeOtpLog({ ...baseLog, status: "error", message });
      emitRealtimeSync("otp:log_created", {
        accountId: account._id,
        accountName: account.accountName,
        status: "error",
        requesterVisitorId,
      });
      throw attachCooldownToError(mailError, cooldownState);
    }

    if (!result.found) {
      const message = `Không tìm thấy OTP mới nhất từ ${senderLabelFromConfig(config)} gửi đúng tới ${account.loginEmail}. Đã quét ${result.scanned || 0}/${result.totalMatchedSender || 0} email, khớp sender ${result.senderMatched || 0}, khớp đúng người nhận ${result.recipientMatched || 0}, email đúng người nhận nhưng chưa đọc được mã ${result.otpMissingAfterRecipientMatch || 0}.`;
      await markOtpScanCooldownResult(cooldownState, "not_found", message);
      await writeOtpLog({
        ...baseLog,
        status: "not_found",
        message,
      });
      emitRealtimeSync("otp:log_created", {
        accountId: account._id,
        accountName: account.accountName,
        status: "not_found",
        requesterVisitorId,
      });
      res.status(404);
      const error = new Error(
        `Không tìm thấy OTP mới nhất gửi đúng tới ${account.loginEmail}. Lưu ý hệ thống check exact cả phần +tag trước @gmail.com.`,
      );
      throw attachCooldownToError(error, cooldownState);
    }

    await markOtpScanCooldownResult(
      cooldownState,
      "success",
      `Đã lấy OTP mới nhất đúng người nhận ${account.loginEmail}`,
    );

    const log = await writeOtpLog({
      ...baseLog,
      status: "success",
      otpCode: result.otpCode,
      subject: result.subject,
      receivedAt: result.receivedAt,
      messageUid: result.messageUid,
      senderEmail: result.senderEmail,
      message: `Đã lấy OTP mới nhất đúng người nhận ${account.loginEmail}`,
    });

    await writeActivityLog({
      req,
      action: "otp_get_success",
      target: account.accountName,
      targetId: account._id,
      description: `${isAdmin ? "Admin" : requesterName} lấy OTP cho ${account.accountName}`,
      metadata: {
        requesterName: isAdmin ? "admin" : requesterName,
        requesterVisitorId,
        recipientEmail: account.loginEmail,
        otpLogId: log._id,
      },
    });

    emitRealtimeSync("otp:log_created", {
      accountId: account._id,
      accountName: account.accountName,
      status: "success",
      requesterVisitorId,
    });

    res.json({
      success: true,
      message: "Đã lấy OTP thành công.",
      data: {
        otpCode: result.otpCode,
        accountId: account._id,
        accountName: account.accountName,
        loginEmail: account.loginEmail,
        recipientEmail: account.loginEmail,
        senderEmail: result.senderEmail,
        subject: result.subject,
        receivedAt: result.receivedAt,
        messageUid: result.messageUid,
        logId: log._id,
        cooldownSeconds: cooldownState.cooldownSeconds,
        cooldownRemainingSeconds: secondsUntil(
          cooldownState.cooldownAvailableAt,
        ),
        cooldownAvailableAt: cooldownState.cooldownAvailableAt,
      },
    });
  } catch (error) {
    if (res.statusCode === 200) res.status(error.statusCode || 400);
    next(error);
  }
}

export async function confirmOtpLogin(req, res, next) {
  try {
    const { id } = req.params;
    const isAdmin = requestIsAdmin(req);
    const requesterName = getRequesterName(req);
    const requesterVisitorId = getRequesterVisitorId(req);
    const logId = cleanText(req.body?.logId || req.body?.otpLogId);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("ID tài khoản không hợp lệ.");
    }

    const account = await Account.findById(id).select(
      "accountName loginEmail ownerName ownerOriginalName ownerIsAdmin ownerOriginalIsAdmin accessRequests",
    );
    if (!account) {
      res.status(404);
      throw new Error("Không tìm thấy tài khoản để xác nhận OTP.");
    }

    const approvedRequest = (account.accessRequests || []).find(
      (request) =>
        request.status === "approved" &&
        requestBelongsToVisitor(request, requesterName, requesterVisitorId),
    );

    if (!isAdmin && !requestIsLoggedInUser(req)) {
      res.status(401);
      throw new Error("Bạn cần đăng nhập tài khoản để xác nhận OTP.");
    }

    if (!isAdmin && !approvedRequest) {
      res.status(403);
      throw new Error(
        "Bạn chưa được admin cấp quyền xác nhận đăng nhập cho tài khoản này.",
      );
    }

    if (isAdmin && !verifyAdminCsrf(req)) {
      res.status(403);
      throw new Error(
        "Phiên admin thiếu CSRF token hợp lệ. Hãy tải lại web hoặc đăng nhập lại admin.",
      );
    }

    const now = new Date();
    let currentName = isAdmin
      ? "admin"
      : await resolveCurrentDisplayName(requesterVisitorId, requesterName);
    currentName = cleanText(currentName) || requesterName || "Người dùng";

    if (!isAdmin && approvedRequest) {
      if (!account.ownerOriginalName) {
        account.ownerOriginalName = account.ownerName || "admin";
        account.ownerOriginalIsAdmin =
          typeof account.ownerIsAdmin === "boolean"
            ? account.ownerIsAdmin
            : true;
      }
      approvedRequest.requesterName = currentName;
      approvedRequest.requesterVisitorId =
        requesterVisitorId || approvedRequest.requesterVisitorId || "";
      approvedRequest.loginConfirmedAt = now;
      account.ownerName = currentName;
      account.ownerIsAdmin = false;
      await account.save();
    }

    let otpLog = null;
    if (mongoose.Types.ObjectId.isValid(logId)) {
      otpLog = await OtpLog.findById(logId);
      if (otpLog) {
        otpLog.loginResult = "done";
        otpLog.loginConfirmedAt = now;
        otpLog.status = "login_confirmed";
        otpLog.message = isAdmin
          ? `Admin xác nhận đã dùng OTP cho ${account.loginEmail}.`
          : `${currentName} xác nhận đã đăng nhập được, chuyển Chủ sở hữu sang ${currentName}.`;
        await otpLog.save();
      }
    }

    await writeActivityLog({
      req,
      action: "otp_login_done",
      target: account.accountName,
      targetId: account._id,
      description: isAdmin
        ? `Admin xác nhận đã đăng nhập được bằng OTP cho ${account.accountName}`
        : `${currentName} xác nhận đã đăng nhập được bằng OTP cho ${account.accountName}`,
      metadata: {
        requesterName: currentName,
        requesterVisitorId,
        loginEmail: account.loginEmail,
        otpLogId: otpLog?._id || logId || "",
        ownerName: account.ownerName,
        ownerOriginalName: account.ownerOriginalName || "",
        ownerIsAdmin: Boolean(account.ownerIsAdmin),
        ownerRole: account.ownerIsAdmin ? "admin" : "user",
      },
    });

    emitRealtimeSync("otp:login_confirmed", {
      accountId: account._id,
      accountName: account.accountName,
      requesterVisitorId,
      ownerIsAdmin: Boolean(account.ownerIsAdmin),
    });

    res.json({
      success: true,
      message: isAdmin
        ? "Đã xác nhận OTP. Admin không làm đổi chủ sở hữu."
        : `Đã xác nhận đăng nhập thành công. Chủ sở hữu đã chuyển sang ${currentName}.`,
      data: {
        accountId: account._id,
        accountName: account.accountName,
        ownerName: account.ownerName,
        ownerOriginalName: account.ownerOriginalName || "",
        ownerIsAdmin: Boolean(account.ownerIsAdmin),
        ownerRole: account.ownerIsAdmin ? "admin" : "user",
        loginConfirmedAt: now,
        otpLogId: otpLog?._id || logId || "",
      },
    });
  } catch (error) {
    if (res.statusCode === 200) res.status(400);
    next(error);
  }
}

export async function bindOtpAccount(req, res, next) {
  try {
    const { id } = req.params;
    const isAdmin = requestIsAdmin(req);
    const requesterName = getRequesterName(req);
    const requesterVisitorId = getRequesterVisitorId(req);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("ID tài khoản không hợp lệ.");
    }

    const account = await Account.findById(id).select(
      "accountName loginEmail accessRequests ownerName",
    );
    if (!account) {
      res.status(404);
      throw new Error("Không tìm thấy tài khoản để gán nhãn OTP.");
    }

    if (!isAdmin && !requestIsLoggedInUser(req)) {
      res.status(401);
      throw new Error("Bạn cần đăng nhập tài khoản để gán OTP.");
    }

    if (
      !isAdmin &&
      !hasApprovedAccountAccess(account, requesterName, requesterVisitorId)
    ) {
      res.status(403);
      throw new Error(
        "Bạn chưa được admin cấp quyền gán OTP cho tài khoản này.",
      );
    }

    if (isAdmin && !verifyAdminCsrf(req)) {
      res.status(403);
      throw new Error(
        "Phiên admin thiếu CSRF token hợp lệ. Hãy tải lại web hoặc đăng nhập lại admin.",
      );
    }

    await bindOtpAccountForVisitor({
      visitorId: requesterVisitorId,
      requesterName,
      account,
    });
    await writeOtpLog({
      accountId: account._id,
      accountName: account.accountName,
      loginEmail: account.loginEmail,
      recipientEmail: account.loginEmail,
      requesterName: isAdmin ? "admin" : requesterName,
      requesterVisitorId,
      requestedByRole: isAdmin ? "admin" : "user",
      status: "bound",
      message: `Đã gán nhãn email đăng nhập ${account.loginEmail} cho phiên lấy OTP.`,
    });

    emitRealtimeSync("otp:account_bound", {
      accountId: account._id,
      accountName: account.accountName,
      requesterVisitorId,
    });

    res.json({
      success: true,
      message: "Đã gán nhãn tài khoản để lấy OTP.",
      data: { accountId: account._id, loginEmail: account.loginEmail },
    });
  } catch (error) {
    next(error);
  }
}
