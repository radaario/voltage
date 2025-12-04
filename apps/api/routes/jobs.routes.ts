import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware.js";
import * as jobsController from "@/controllers/jobs.controller.js";

const router = Router();

router.get("/jobs", authMiddleware(), jobsController.getJobs);
router.put("/jobs", authMiddleware(), jobsController.createJob);
router.post("/jobs/retry", authMiddleware(), jobsController.retryJob);
router.delete("/jobs", authMiddleware(), jobsController.deleteJobs);
router.get("/jobs/preview", jobsController.getJobPreview);

export default router;
