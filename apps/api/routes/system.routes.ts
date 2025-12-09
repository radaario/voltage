import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware.js";
import * as systemController from "@/controllers/system.controller.js";

const router = Router();

router.delete("/all", authMiddleware(), systemController.deleteAllData);

export default router;
