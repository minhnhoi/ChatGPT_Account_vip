import crypto from "crypto";
import AppUser from "../models/AppUser.js";
import VisitorProfile, {
  DEFAULT_PROFILE_PREFERENCES,
} from "../models/VisitorProfile.js";
import { env } from "../config/env.js";
import {
  clearAdminAuthCookie,
  createAdminToken,
  setAdminAuthCookie,
} from "../utils/adminAuth.js";
import {
  clearUserAuthCookie,
  comparePassword,
  createUserAuthToken,
  ensureHash,
  getUserSessionFromRequest,
  getUserAuthTokenFromRequest,
  hashPassword,
  setUserAuthCookie,
} from "../utils/userAuth.js";
import {
  createVisitorClientToken,
  getVisitorIdFromRequest,
  setVisitorCookie,
} from "../utils/visitorSession.js";
import { writeActivityLog } from "../utils/auditLog.js";
import { emitRealtimeSync } from "../socket.js";

function cleanText(value, max = 160) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

function cleanUsername(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .slice(0, 40);
}

function cleanEmail(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, 160);
}

function publicUser(user) {
  if (!user) return null;
  const raw = typeof user.toJSON === "function" ? user.toJSON() : { ...user };
  delete raw.passwordHash;
  return {
    _id: raw._id,
    username: raw.username,
    email: raw.email || "",
    displayName: raw.displayName,
    role: raw.role,
    status: raw.status,
    linkedVisitorId: raw.linkedVisitorId,
    lastLoginAt: raw.lastLoginAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

async function syncProfileForUser(user) {
  if (!user?.linkedVisitorId) return null;
  const profile = await VisitorProfile.findOneAndUpdate(
    { visitorId: user.linkedVisitorId },
    {
      $setOnInsert: {
        visitorId: user.linkedVisitorId,
        preferences: DEFAULT_PROFILE_PREFERENCES,
        seenNotifications: { user: [], admin: [] },
      },
      $set: {
        displayName: user.displayName || user.username || "User",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const data = profile.toObject ? profile.toObject() : { ...profile };
  data.visitorClientToken = createVisitorClientToken(user.linkedVisitorId);
  return data;
}

function validateRegisterPayload({ username, displayName, password }) {
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    const error = new Error(
      "Tên đăng nhập cần 3-40 ký tự, chỉ gồm chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang.",
    );
    error.statusCode = 400;
    throw error;
  }
  if (displayName.length < 2) {
    const error = new Error("Tên hiển thị cần ít nhất 2 ký tự.");
    error.statusCode = 400;
    throw error;
  }
  if (String(password || "").length < 6) {
    const error = new Error("Mật khẩu cần ít nhất 6 ký tự.");
    error.statusCode = 400;
    throw error;
  }
}

function buildAuthResponse({
  user,
  userTokenData,
  adminTokenData = null,
  profile = null,
}) {
  return {
    user: publicUser(user),
    auth: {
      isAuthenticated: true,
      role: user.role,
      csrfToken: userTokenData.csrfToken,
      sessionToken: userTokenData.token,
      expiresAt: userTokenData.expiresAt,
    },
    admin: adminTokenData
      ? {
          isAdmin: true,
          csrfToken: adminTokenData.csrfToken,
          sessionToken: adminTokenData.token,
          expiresAt: adminTokenData.expiresAt,
        }
      : { isAdmin: false },
    profile,
  };
}

export async function ensureBootstrapAdminUser() {
  const username =
    cleanUsername(env.bootstrapAdminUsername || "admin") || "admin";
  const displayName =
    cleanText(env.bootstrapAdminDisplayName || "Admin", 80) || "Admin";
  const email = cleanEmail(env.bootstrapAdminEmail || "");
  const passwordHash = await ensureHash(
    env.adminPasswordHash || env.adminPassword || "",
  );

  if (!passwordHash) return null;

  const existingByUsername = await AppUser.findOne({ username });
  if (existingByUsername) {
    let changed = false;
    if (existingByUsername.role !== "admin") {
      existingByUsername.role = "admin";
      changed = true;
    }
    if (existingByUsername.status !== "active") {
      existingByUsername.status = "active";
      changed = true;
    }
    if (!existingByUsername.linkedVisitorId) {
      existingByUsername.linkedVisitorId = crypto.randomUUID();
      changed = true;
    }
    if (changed) await existingByUsername.save();
    await syncProfileForUser(existingByUsername);
    return existingByUsername;
  }

  const hasAnyAdmin = await AppUser.exists({ role: "admin" });
  if (hasAnyAdmin) return null;

  const admin = await AppUser.create({
    username,
    email,
    displayName,
    passwordHash,
    role: "admin",
    status: "active",
    linkedVisitorId: crypto.randomUUID(),
    createdBySystem: true,
  });
  await syncProfileForUser(admin);
  console.log(`Đã tự tạo tài khoản admin MongoDB: ${username}`);
  return admin;
}

export async function registerUser(req, res, next) {
  try {
    const username = cleanUsername(req.body?.username);
    const displayName = cleanText(
      req.body?.displayName || req.body?.name || username,
      80,
    );
    const email = cleanEmail(req.body?.email || "");
    const password = String(req.body?.password || "");

    validateRegisterPayload({ username, displayName, password });

    const existing = await AppUser.findOne({ username });
    if (existing) {
      res.status(409);
      throw new Error(
        "Tên đăng nhập này đã tồn tại. Hãy chọn tên khác hoặc đăng nhập.",
      );
    }

    let visitorId =
      getVisitorIdFromRequest(req, res, { createIfMissing: true }) ||
      crypto.randomUUID();
    const existingVisitorOwner = await AppUser.exists({
      linkedVisitorId: visitorId,
    });
    if (existingVisitorOwner) visitorId = crypto.randomUUID();

    const user = await AppUser.create({
      username,
      email,
      displayName,
      passwordHash: await hashPassword(password),
      role: "user",
      status: "active",
      linkedVisitorId: visitorId,
    });

    await syncProfileForUser(user);

    await writeActivityLog({
      req,
      action: "auth_register",
      target: user.username,
      targetId: user._id,
      description: `${user.displayName} đăng ký tài khoản người dùng`,
      metadata: {
        username: user.username,
        role: user.role,
        requesterVisitorId: user.linkedVisitorId,
      },
    });

    emitRealtimeSync("auth:user_registered", {
      visitorId: user.linkedVisitorId,
      username: user.username,
    });

    res.status(201).json({
      success: true,
      message: "Đăng ký thành công. Hãy đăng nhập bằng tài khoản vừa tạo.",
      data: {
        user: publicUser(user),
        nextAction: "login",
      },
    });
  } catch (error) {
    if (res.statusCode === 200) res.status(error.statusCode || 400);
    next(error);
  }
}

export async function loginUser(req, res, next) {
  try {
    const login = cleanUsername(req.body?.username || req.body?.login || "");
    const password = String(req.body?.password || "");

    if (!login || !password) {
      res.status(400);
      throw new Error("Nhập tên đăng nhập và mật khẩu.");
    }

    const user = await AppUser.findOne({
      $or: [
        { username: login },
        { email: cleanEmail(req.body?.username || req.body?.login || "") },
      ],
    }).select("+passwordHash");

    if (!user || user.status !== "active") {
      res.status(401);
      throw new Error("Tài khoản không tồn tại hoặc đã bị khóa.");
    }

    const passwordOk = await comparePassword(password, user.passwordHash);
    if (!passwordOk) {
      res.status(401);
      throw new Error("Sai tên đăng nhập hoặc mật khẩu.");
    }

    if (!user.linkedVisitorId) user.linkedVisitorId = crypto.randomUUID();
    user.lastLoginAt = new Date();
    await user.save();

    setVisitorCookie(res, user.linkedVisitorId);
    const profile = await syncProfileForUser(user);
    const userTokenData = createUserAuthToken(user);
    setUserAuthCookie(res, userTokenData.token, userTokenData.expiresAt);

    let adminTokenData = null;
    if (user.role === "admin") {
      adminTokenData = createAdminToken();
      setAdminAuthCookie(res, adminTokenData.token, adminTokenData.expiresAt);
    }

    await writeActivityLog({
      req,
      action: user.role === "admin" ? "auth_admin_login" : "auth_user_login",
      target: user.username,
      targetId: user._id,
      description: `${user.displayName} đăng nhập ${user.role === "admin" ? "admin" : "người dùng"}`,
      metadata: {
        username: user.username,
        role: user.role,
        requesterVisitorId: user.linkedVisitorId,
      },
    });

    res.json({
      success: true,
      message:
        user.role === "admin"
          ? "Đã đăng nhập admin bằng tài khoản MongoDB."
          : "Đăng nhập thành công.",
      data: buildAuthResponse({ user, userTokenData, adminTokenData, profile }),
    });
  } catch (error) {
    if (res.statusCode === 200) res.status(400);
    next(error);
  }
}

export async function getAuthSession(req, res, next) {
  try {
    const session = getUserSessionFromRequest(req);
    if (!session) {
      return res.json({
        success: true,
        data: {
          auth: { isAuthenticated: false },
          admin: { isAdmin: false },
          user: null,
        },
      });
    }

    const user = await AppUser.findById(session.uid).select("+passwordHash");
    if (!user || user.status !== "active") {
      clearUserAuthCookie(res);
      clearAdminAuthCookie(res);
      return res.json({
        success: true,
        data: {
          auth: { isAuthenticated: false },
          admin: { isAdmin: false },
          user: null,
        },
      });
    }

    setVisitorCookie(res, user.linkedVisitorId);
    const profile = await syncProfileForUser(user);
    const userTokenData = {
      token: getUserAuthTokenFromRequest(req),
      csrfToken: session.csrf || "",
      expiresAt: new Date(session.exp).toISOString(),
    };

    let adminTokenData = null;
    if (user.role === "admin") {
      adminTokenData = createAdminToken();
      setAdminAuthCookie(res, adminTokenData.token, adminTokenData.expiresAt);
    }

    res.json({
      success: true,
      data: buildAuthResponse({ user, userTokenData, adminTokenData, profile }),
    });
  } catch (error) {
    next(error);
  }
}

export async function logoutUser(req, res, next) {
  try {
    const session = getUserSessionFromRequest(req);
    clearUserAuthCookie(res);
    clearAdminAuthCookie(res);

    await writeActivityLog({
      req,
      action: "auth_logout",
      target: session?.username || "auth",
      description: "Đăng xuất tài khoản và xóa cookie phiên đăng nhập",
      metadata: {
        requesterVisitorId: session?.visitorId || "",
        role: session?.role || "guest",
      },
    });

    res.json({ success: true, message: "Đã đăng xuất tài khoản." });
  } catch (error) {
    next(error);
  }
}
