import { Router } from "express";
import * as authController from "@/controllers/auth.controller.js";
import { authRateLimitMiddleware } from "@/middleware/rate-limit.middleware.js";

const router = Router();

router.post("/auth", authRateLimitMiddleware(), authController.authenticate);

export default router;
