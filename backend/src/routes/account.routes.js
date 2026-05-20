import express from "express";
import rateLimit from "express-rate-limit";
import {
  approveAccountAccess,
  createAccount,
  deleteAccount,
  deleteAccountAccess,
  getAccounts,
  getAdminSession,
  getStats,
  logoutAdmin,
  rejectAccountAccess,
  renameVisitorName,
  requestAccountAccess,
  revealPassword,
  revokeAccountAccess,
  updateAccount,
  verifyAdminAccess,
} from "../controllers/account.controller.js";
import { requireAdmin } from "../utils/adminAuth.js";

const router = express.Router();

const adminVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Bạn nhập thử quá nhiều lần. Hãy đợi 15 phút rồi thử lại.",
  },
});

const revealLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Bạn nhập thử quá nhiều lần. Hãy đợi 1 phút rồi thử lại.",
  },
});

const accessRequestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Bạn gửi yêu cầu quyền quá nhanh. Hãy đợi một lát rồi thử lại.",
  },
});

router.post("/admin/verify", adminVerifyLimiter, verifyAdminAccess);
router.get("/admin/session", getAdminSession);
router.post("/admin/logout", logoutAdmin);

router.get("/stats", getStats);
router.patch("/visitor-name", renameVisitorName);
router.get("/", getAccounts);
router.post("/", requireAdmin, createAccount);
router.post("/:id/request-access", accessRequestLimiter, requestAccountAccess);
router.post(
  "/:id/access/:requestId/approve",
  requireAdmin,
  approveAccountAccess,
);
router.post("/:id/access/:requestId/reject", requireAdmin, rejectAccountAccess);
router.post("/:id/access/:requestId/revoke", requireAdmin, revokeAccountAccess);
router.post("/:id/access/:requestId/delete", requireAdmin, deleteAccountAccess);
router.put("/:id", updateAccount);
router.delete("/:id", requireAdmin, deleteAccount);
router.post("/:id/reveal-password", revealLimiter, revealPassword);

export default router;
