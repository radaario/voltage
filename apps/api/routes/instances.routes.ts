import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware.js";
import * as instancesController from "@/controllers/instances.controller.js";

const router = Router();

router.get("/instances", authMiddleware(), instancesController.getInstances);
router.delete("/instances", authMiddleware(), instancesController.deleteInstances);

router.get("/instances/workers", authMiddleware(), instancesController.getWorkers);
router.delete("/instances/workers", authMiddleware(), instancesController.deleteWorkers);

export default router;
