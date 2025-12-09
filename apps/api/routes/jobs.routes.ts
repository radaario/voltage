import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware.js";
import * as jobsController from "@/controllers/jobs.controller.js";

const router = Router();

router.get("/jobs", authMiddleware(), jobsController.getJobs);
router.put("/jobs", authMiddleware(), jobsController.createJob);
router.post("/jobs", authMiddleware(), jobsController.createJob);
router.post("/jobs/retry", authMiddleware(), jobsController.retryJob);
router.delete("/jobs", authMiddleware(), jobsController.deleteJobs);
router.get("/jobs/preview", jobsController.getJobPreview);

router.get("/jobs/outputs", authMiddleware(), jobsController.getOutputs);
router.post("/jobs/outputs/retry", authMiddleware(), jobsController.retryJob);

router.get("/jobs/notifications", authMiddleware(), jobsController.getNotifications);
router.post("/jobs/notifications/retry", authMiddleware(), jobsController.retryNotification);
router.delete("/jobs/notifications", authMiddleware(), jobsController.deleteNotifications);

export default router;
