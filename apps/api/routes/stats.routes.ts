import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware.js";
import * as statsController from "@/controllers/stats.controller.js";

const router = Router();

router.get("/stats", authMiddleware(), statsController.getStats);
router.delete("/stats", authMiddleware(), statsController.deleteStats);

export default router;
