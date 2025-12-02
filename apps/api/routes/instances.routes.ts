import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import * as instancesController from "@/controllers/instances.controller";

const router = Router();

router.get("/instances", authMiddleware(), instancesController.getInstances);
router.delete("/instances", authMiddleware(), instancesController.deleteInstances);

export default router;
