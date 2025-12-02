import { Router } from "express";
import * as authController from "@/controllers/auth.controller";

const router = Router();

router.post("/auth", authController.authenticate);

export default router;
