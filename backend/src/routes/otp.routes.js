import express from "express";
import rateLimit from "express-rate-limit";
import {
  bindOtpAccount,
  confirmOtpLogin,
  getMailConfig,
  getOtpForAccount,
  getOtpLogs,
  saveMailConfig,
  testMailConfig,
} from "../controllers/otp.controller.js";
import { requireAdmin } from "../utils/adminAuth.js";

const router = express.Router();

const otpLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Bạn lấy OTP quá nhanh. Hãy chờ 1 phút rồi thử lại.",
  },
});

router.get("/config", requireAdmin, getMailConfig);
router.put("/config", requireAdmin, saveMailConfig);
router.post("/config/test", requireAdmin, testMailConfig);
router.get("/logs", requireAdmin, getOtpLogs);
router.post("/accounts/:id/bind", bindOtpAccount);
router.post("/accounts/:id/get", otpLimiter, getOtpForAccount);
router.post("/accounts/:id/confirm-login", otpLimiter, confirmOtpLogin);

export default router;
