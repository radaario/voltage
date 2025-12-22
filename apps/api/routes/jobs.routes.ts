import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware.js";
import { validateMiddleware } from "@/middleware/validate.middleware.js";
import * as jobsController from "@/controllers/jobs.controller.js";
import { jobSchema } from "@/schemas/job.schemas.js";
import { JobRequest } from "@voltage/core/types";

const router = Router();

// Jobs routes
router.get("/jobs", authMiddleware(), jobsController.getJobs);

router.put("/jobs", authMiddleware(), validateMiddleware<JobRequest>(jobSchema), jobsController.createJob);
router.post("/jobs", authMiddleware(), validateMiddleware<JobRequest>(jobSchema), jobsController.createJob);

router.post("/jobs/retry", authMiddleware(), jobsController.retryJob);
router.delete("/jobs", authMiddleware(), jobsController.deleteJobs);
router.get("/jobs/preview", jobsController.getJobPreview);

// Jobs outputs routes
router.get("/jobs/outputs", authMiddleware(), jobsController.getOutputs);
router.post("/jobs/outputs/retry", authMiddleware(), jobsController.retryJob);

// Jobs notifications routes
router.get("/jobs/notifications", authMiddleware(), jobsController.getNotifications);
router.post("/jobs/notifications/retry", authMiddleware(), jobsController.retryNotification);
router.delete("/jobs/notifications", authMiddleware(), jobsController.deleteNotifications);

export default router;
