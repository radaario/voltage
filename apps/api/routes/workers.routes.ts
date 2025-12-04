import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware.js";
import * as workersController from "@/controllers/workers.controller.js";

const router = Router();

router.get("/instances/workers", authMiddleware(), workersController.getWorkers);
router.delete("/instances/workers", authMiddleware(), workersController.deleteWorkers);

export default router;
