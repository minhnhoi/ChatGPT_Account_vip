import express from "express";
import { getActivityLogs } from "../controllers/activity.controller.js";

const router = express.Router();

router.get("/", getActivityLogs);

export default router;
