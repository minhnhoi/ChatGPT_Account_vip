import express from "express";
import {
  exportBackup,
  importBackup,
} from "../controllers/backup.controller.js";
import { requireAdmin } from "../utils/adminAuth.js";

const router = express.Router();

router.get("/export", requireAdmin, exportBackup);
router.post("/import", requireAdmin, importBackup);

export default router;
