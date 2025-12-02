import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import * as systemController from "@/controllers/system.controller";

const router = Router();

router.delete("/all", authMiddleware(), systemController.deleteAllData);

export default router;
