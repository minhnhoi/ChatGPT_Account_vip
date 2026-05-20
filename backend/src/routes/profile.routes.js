import express from "express";
import {
  getProfile,
  markNotificationsSeen,
  updateProfileName,
  updateProfilePreferences,
} from "../controllers/profile.controller.js";

const router = express.Router();

router.get("/", getProfile);
router.patch("/name", updateProfileName);
router.patch("/preferences", updateProfilePreferences);
router.patch("/notifications/seen", markNotificationsSeen);

export default router;
