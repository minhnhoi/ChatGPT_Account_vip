import express from "express";
import rateLimit from "express-rate-limit";
import {
  getAuthSession,
  loginUser,
  logoutUser,
  registerUser,
} from "../controllers/auth.controller.js";

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 24,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Bạn thao tác đăng nhập/đăng ký quá nhanh. Hãy đợi một lát rồi thử lại.",
  },
});

router.get("/session", getAuthSession);
router.post("/register", authLimiter, registerUser);
router.post("/login", authLimiter, loginUser);
router.post("/logout", logoutUser);

export default router;
