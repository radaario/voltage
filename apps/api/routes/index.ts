import { Express, Request, Response } from "express";
import { config } from "@voltage/config";
import { sanitizeData } from "@voltage/utils";
import { sendSuccess } from "@/utils/response.util";

// Import routes
import authRoutes from "./auth.routes";
import statsRoutes from "./stats.routes";
import logsRoutes from "./logs.routes";
import instancesRoutes from "./instances.routes";
import workersRoutes from "./workers.routes";
import jobsRoutes from "./jobs.routes";
import notificationsRoutes from "./notifications.routes";
import systemRoutes from "./system.routes";

export const registerRoutes = (app: Express) => {
	// Health & Status endpoints
	app.get(["/status", "/health"], (req: Request, res: Response) => {
		return sendSuccess(res);
	});

	// Config endpoint
	app.get("/config", async (req: Request, res: Response) => {
		return sendSuccess(res, sanitizeData(config));
	});

	// Register all routes
	app.use(authRoutes);
	app.use(statsRoutes);
	app.use(logsRoutes);
	app.use(instancesRoutes);
	app.use(workersRoutes);
	app.use(jobsRoutes);
	app.use(notificationsRoutes);
	app.use(systemRoutes);
};
