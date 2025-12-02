import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import * as statsController from "@/controllers/stats.controller";

const router = Router();

router.get("/stats", authMiddleware(), statsController.getStats);
router.delete("/stats", authMiddleware(), statsController.deleteStats);

export default router;
