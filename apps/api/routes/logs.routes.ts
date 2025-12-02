import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import * as logsController from "@/controllers/logs.controller";

const router = Router();

router.get("/logs", authMiddleware(), logsController.getLogs);
router.delete("/logs", authMiddleware(), logsController.deleteLogs);

export default router;
