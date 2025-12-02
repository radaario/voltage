import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import * as workersController from "@/controllers/workers.controller";

const router = Router();

router.get("/instances/workers", authMiddleware(), workersController.getWorkers);
router.delete("/instances/workers", authMiddleware(), workersController.deleteWorkers);

export default router;
