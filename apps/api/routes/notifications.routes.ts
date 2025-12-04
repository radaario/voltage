import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware.js";
import * as notificationsController from "@/controllers/notifications.controller.js";

const router = Router();

router.get("/jobs/notifications", authMiddleware(), notificationsController.getNotifications);
router.post("/jobs/notifications/retry", authMiddleware(), notificationsController.retryNotification);
router.delete("/jobs/notifications", authMiddleware(), notificationsController.deleteNotifications);

export default router;
