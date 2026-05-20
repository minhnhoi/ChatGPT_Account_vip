import Account from "../models/Account.js";
import ActivityLog from "../models/ActivityLog.js";
import VisitorProfile, {
  DEFAULT_PROFILE_PREFERENCES,
} from "../models/VisitorProfile.js";
import MailConfig from "../models/MailConfig.js";
import OtpLog from "../models/OtpLog.js";
import OtpScanCooldown from "../models/OtpScanCooldown.js";
import { encryptText } from "../utils/cryptoVault.js";
import { writeActivityLog } from "../utils/auditLog.js";

function normalizeAccessRequests(accessRequests) {
  if (!Array.isArray(accessRequests)) return [];
  const allowed = new Set(["pending", "approved", "rejected", "revoked"]);
  return accessRequests
    .filter((item) => item?.requesterName)
    .map((item) => ({
      requesterName: String(item.requesterName).trim().slice(0, 80),
      requesterVisitorId: item.requesterVisitorId
        ? String(item.requesterVisitorId).trim().slice(0, 120)
        : "",
      status: allowed.has(item.status) ? item.status : "pending",
      requestedAt: item.requestedAt || new Date(),
      decidedAt: item.decidedAt || null,
      decidedBy: item.decidedBy || "",
      decisionReason: String(item.decisionReason || "")
        .trim()
        .slice(0, 360),
      loginConfirmedAt: item.loginConfirmedAt || null,
      clientInfo: item.clientInfo || {},
      hiddenFromAdmin: Boolean(item.hiddenFromAdmin),
    }))
    .filter((item) => item.requesterName);
}

function normalizeTags(tags) {
  if (!tags) return [];
  const source = Array.isArray(tags) ? tags : String(tags).split(",");
  return source
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeProfile(item) {
  if (!item?.visitorId) return null;
  return {
    visitorId: String(item.visitorId).trim().slice(0, 120),
    displayName:
      String(item.displayName || "non")
        .trim()
        .slice(0, 80) || "non",
    preferences: {
      ...DEFAULT_PROFILE_PREFERENCES,
      ...(item.preferences || {}),
    },
    seenNotifications: {
      user: Array.isArray(item.seenNotifications?.user)
        ? item.seenNotifications.user.map(String).slice(0, 500)
        : [],
      admin: Array.isArray(item.seenNotifications?.admin)
        ? item.seenNotifications.admin.map(String).slice(0, 500)
        : [],
    },
    otpBinding: item.otpBinding || {},
  };
}

function normalizeMailConfig(item) {
  if (!item) return null;
  return {
    key: "default",
    imapEmail: String(item.imapEmail || "")
      .trim()
      .toLowerCase()
      .slice(0, 160),
    imapHost: String(item.imapHost || "imap.gmail.com")
      .trim()
      .slice(0, 120),
    imapPort: Math.min(65535, Math.max(1, Number(item.imapPort || 993))),
    useTLS: item.useTLS !== false,
    appPasswordEncrypted: String(item.appPasswordEncrypted || ""),
    senderEmail: String(item.senderEmail || "noreply@tm.openai.com")
      .trim()
      .toLowerCase()
      .slice(0, 160),
    mailbox: String(item.mailbox || "INBOX")
      .trim()
      .slice(0, 80),
    searchDays: Math.min(365, Math.max(1, Number(item.searchDays || 14))),
    fetchLimit: Math.min(300, Math.max(5, Number(item.fetchLimit || 80))),
    enabled: Boolean(item.enabled),
    lastTestAt: item.lastTestAt || null,
    lastTestStatus: String(item.lastTestStatus || "").slice(0, 80),
  };
}

function normalizeOtpLog(item) {
  if (!item?.status) return null;
  return {
    accountId: item.accountId || null,
    accountName: String(item.accountName || "").slice(0, 120),
    loginEmail: String(item.loginEmail || "")
      .toLowerCase()
      .slice(0, 160),
    recipientEmail: String(item.recipientEmail || item.loginEmail || "")
      .toLowerCase()
      .slice(0, 160),
    requesterName: String(item.requesterName || "").slice(0, 80),
    requesterVisitorId: String(item.requesterVisitorId || "").slice(0, 120),
    requestedByRole: item.requestedByRole === "admin" ? "admin" : "user",
    otpCode: String(item.otpCode || "").slice(0, 12),
    senderEmail: String(item.senderEmail || "")
      .toLowerCase()
      .slice(0, 160),
    subject: String(item.subject || "").slice(0, 240),
    receivedAt: item.receivedAt || null,
    messageUid: String(item.messageUid || "").slice(0, 80),
    status: [
      "success",
      "not_found",
      "error",
      "config_missing",
      "bound",
      "cooldown",
      "login_confirmed",
      "login_not_confirmed",
    ].includes(item.status)
      ? item.status
      : "error",
    message: String(item.message || "").slice(0, 500),
    loginResult: ["pending", "done", "not_done", ""].includes(item.loginResult)
      ? item.loginResult
      : "",
    loginConfirmedAt: item.loginConfirmedAt || null,
    createdAt: item.createdAt || new Date(),
  };
}

function normalizeActivityLog(item) {
  if (!item?.action) return null;
  return {
    action: String(item.action).trim().slice(0, 80),
    target: String(item.target || "system")
      .trim()
      .slice(0, 120),
    targetId: String(item.targetId || "")
      .trim()
      .slice(0, 80),
    description: String(item.description || "")
      .trim()
      .slice(0, 300),
    ip: String(item.ip || "")
      .trim()
      .slice(0, 80),
    metadata: item.metadata || {},
    createdAt: item.createdAt || new Date(),
  };
}

function normalizeOtpScanCooldown(item) {
  if (!item?.visitorId || !item?.accountId) return null;
  return {
    visitorId: String(item.visitorId || "")
      .trim()
      .slice(0, 160),
    requesterName: String(item.requesterName || "")
      .trim()
      .slice(0, 80),
    requestedByRole: item.requestedByRole === "admin" ? "admin" : "user",
    accountId: item.accountId || null,
    accountName: String(item.accountName || "")
      .trim()
      .slice(0, 120),
    loginEmail: String(item.loginEmail || "")
      .trim()
      .toLowerCase()
      .slice(0, 160),
    lastScanAt: item.lastScanAt || null,
    nextAllowedAt: item.nextAllowedAt || null,
    cooldownSeconds: Math.min(
      3600,
      Math.max(1, Number(item.cooldownSeconds || 45)),
    ),
    lastResultStatus: String(item.lastResultStatus || "").slice(0, 40),
    lastMessage: String(item.lastMessage || "").slice(0, 240),
  };
}

export async function exportBackup(req, res, next) {
  try {
    const [
      accounts,
      visitorProfiles,
      activityLogs,
      mailConfigs,
      otpLogs,
      otpScanCooldowns,
    ] = await Promise.all([
      Account.find().sort({ createdAt: -1 }).lean(),
      VisitorProfile.find().sort({ updatedAt: -1 }).lean(),
      ActivityLog.find().sort({ createdAt: -1 }).limit(1000).lean(),
      MailConfig.find().lean(),
      OtpLog.find().sort({ createdAt: -1 }).limit(1000).lean(),
      OtpScanCooldown.find().sort({ updatedAt: -1 }).limit(1000).lean(),
    ]);

    const payload = {
      app: "account-vault-tool",
      version: 3,
      exportedAt: new Date().toISOString(),
      note: "Backup này giữ passwordEncrypted và appPasswordEncrypted. Muốn restore được pass/mail app password cần dùng đúng ENCRYPTION_KEY cũ. Hồ sơ người dùng, cài đặt, trạng thái thông báo, cấu hình mail và lịch sử OTP cũng nằm trong MongoDB.",
      accounts,
      visitorProfiles,
      activityLogs,
      mailConfigs,
      otpLogs,
      otpScanCooldowns,
    };

    await writeActivityLog({
      req,
      action: "backup_export",
      target: "backup",
      description: `Xuất backup ${accounts.length} tài khoản, ${visitorProfiles.length} hồ sơ, ${activityLogs.length} log, ${otpLogs.length} OTP log, ${otpScanCooldowns.length} cooldown OTP`,
      metadata: {
        accountCount: accounts.length,
        profileCount: visitorProfiles.length,
        logCount: activityLogs.length,
        otpLogCount: otpLogs.length,
        mailConfigCount: mailConfigs.length,
        otpScanCooldownCount: otpScanCooldowns.length,
      },
    });

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=account-vault-backup-${Date.now()}.json`,
    );
    res.json({ success: true, data: payload });
  } catch (error) {
    next(error);
  }
}

export async function importBackup(req, res, next) {
  try {
    const sourceAccounts = Array.isArray(req.body?.accounts)
      ? req.body.accounts
      : Array.isArray(req.body?.data?.accounts)
        ? req.body.data.accounts
        : [];
    const sourceProfiles = Array.isArray(req.body?.visitorProfiles)
      ? req.body.visitorProfiles
      : Array.isArray(req.body?.data?.visitorProfiles)
        ? req.body.data.visitorProfiles
        : [];
    const sourceLogs = Array.isArray(req.body?.activityLogs)
      ? req.body.activityLogs
      : Array.isArray(req.body?.data?.activityLogs)
        ? req.body.data.activityLogs
        : [];
    const sourceMailConfigs = Array.isArray(req.body?.mailConfigs)
      ? req.body.mailConfigs
      : Array.isArray(req.body?.data?.mailConfigs)
        ? req.body.data.mailConfigs
        : [];
    const sourceOtpLogs = Array.isArray(req.body?.otpLogs)
      ? req.body.otpLogs
      : Array.isArray(req.body?.data?.otpLogs)
        ? req.body.data.otpLogs
        : [];
    const sourceOtpScanCooldowns = Array.isArray(req.body?.otpScanCooldowns)
      ? req.body.otpScanCooldowns
      : Array.isArray(req.body?.data?.otpScanCooldowns)
        ? req.body.data.otpScanCooldowns
        : [];

    const mappedAccounts = sourceAccounts
      .filter(
        (item) =>
          item?.ownerName &&
          item?.loginEmail &&
          item?.accountName &&
          (item?.passwordEncrypted || item?.password),
      )
      .map((item) => ({
        ownerName: String(item.ownerName).trim(),
        ownerOriginalName: item.ownerOriginalName
          ? String(item.ownerOriginalName).trim().slice(0, 80)
          : "",
        ownerIsAdmin:
          typeof item.ownerIsAdmin === "boolean"
            ? item.ownerIsAdmin
            : undefined,
        ownerOriginalIsAdmin:
          typeof item.ownerOriginalIsAdmin === "boolean"
            ? item.ownerOriginalIsAdmin
            : true,
        loginEmail: String(item.loginEmail).trim(),
        passwordEncrypted:
          item.passwordEncrypted || encryptText(String(item.password).trim()),
        accountName: String(item.accountName).trim(),
        planVersion: item.planVersion || "free",
        status: item.status || "new",
        renewalDate: item.renewalDate || null,
        tags: normalizeTags(item.tags),
        note: item.note || "",
        accessRequests: normalizeAccessRequests(item.accessRequests),
      }));

    const mappedProfiles = sourceProfiles.map(normalizeProfile).filter(Boolean);
    const mappedLogs = sourceLogs.map(normalizeActivityLog).filter(Boolean);
    const mappedMailConfigs = sourceMailConfigs
      .map(normalizeMailConfig)
      .filter(Boolean);
    const mappedOtpLogs = sourceOtpLogs.map(normalizeOtpLog).filter(Boolean);
    const mappedOtpScanCooldowns = sourceOtpScanCooldowns
      .map(normalizeOtpScanCooldown)
      .filter(Boolean);

    if (
      !mappedAccounts.length &&
      !mappedProfiles.length &&
      !mappedLogs.length &&
      !mappedMailConfigs.length &&
      !mappedOtpLogs.length &&
      !mappedOtpScanCooldowns.length
    ) {
      res.status(400);
      throw new Error("File backup không có dữ liệu hợp lệ để import");
    }

    let insertedAccounts = 0;
    let upsertedProfiles = 0;
    let insertedLogs = 0;
    let upsertedMailConfigs = 0;
    let insertedOtpLogs = 0;
    let upsertedOtpScanCooldowns = 0;

    if (mappedAccounts.length) {
      const inserted = await Account.insertMany(mappedAccounts, {
        ordered: false,
      });
      insertedAccounts = inserted.length;
    }

    if (mappedProfiles.length) {
      const result = await VisitorProfile.bulkWrite(
        mappedProfiles.map((profile) => ({
          updateOne: {
            filter: { visitorId: profile.visitorId },
            update: { $set: profile },
            upsert: true,
          },
        })),
        { ordered: false },
      );
      upsertedProfiles =
        (result.upsertedCount || 0) +
        (result.modifiedCount || 0) +
        (result.matchedCount || 0);
    }

    if (mappedLogs.length) {
      const inserted = await ActivityLog.insertMany(mappedLogs, {
        ordered: false,
      });
      insertedLogs = inserted.length;
    }

    if (mappedMailConfigs.length) {
      const result = await MailConfig.bulkWrite(
        mappedMailConfigs.map((config) => ({
          updateOne: {
            filter: { key: config.key || "default" },
            update: { $set: config },
            upsert: true,
          },
        })),
        { ordered: false },
      );
      upsertedMailConfigs =
        (result.upsertedCount || 0) +
        (result.modifiedCount || 0) +
        (result.matchedCount || 0);
    }

    if (mappedOtpLogs.length) {
      const inserted = await OtpLog.insertMany(mappedOtpLogs, {
        ordered: false,
      });
      insertedOtpLogs = inserted.length;
    }

    if (mappedOtpScanCooldowns.length) {
      const result = await OtpScanCooldown.bulkWrite(
        mappedOtpScanCooldowns.map((cooldown) => ({
          updateOne: {
            filter: {
              visitorId: cooldown.visitorId,
              accountId: cooldown.accountId,
            },
            update: { $set: cooldown },
            upsert: true,
          },
        })),
        { ordered: false },
      );
      upsertedOtpScanCooldowns =
        (result.upsertedCount || 0) +
        (result.modifiedCount || 0) +
        (result.matchedCount || 0);
    }

    await writeActivityLog({
      req,
      action: "backup_import",
      target: "backup",
      description: `Import ${insertedAccounts} tài khoản, ${upsertedProfiles} hồ sơ, ${insertedLogs} log, ${upsertedMailConfigs} mail config, ${insertedOtpLogs} OTP log, ${upsertedOtpScanCooldowns} cooldown OTP từ backup`,
      metadata: {
        accountCount: insertedAccounts,
        profileCount: upsertedProfiles,
        logCount: insertedLogs,
        mailConfigCount: upsertedMailConfigs,
        otpLogCount: insertedOtpLogs,
        otpScanCooldownCount: upsertedOtpScanCooldowns,
      },
    });

    res.status(201).json({
      success: true,
      message: `Đã import ${insertedAccounts} tài khoản, ${upsertedProfiles} hồ sơ, ${insertedLogs} log, ${upsertedMailConfigs} mail config, ${insertedOtpLogs} OTP log, ${upsertedOtpScanCooldowns} cooldown OTP`,
      data: {
        insertedAccounts,
        upsertedProfiles,
        insertedLogs,
        upsertedMailConfigs,
        insertedOtpLogs,
        upsertedOtpScanCooldowns,
      },
    });
  } catch (error) {
    if (res.statusCode === 200) res.status(400);
    next(error);
  }
}
