import { Express, Request, Response } from "express";
import { config } from "@voltage/config";
import { sanitizeData } from "@voltage/utils";
import { sendSuccess } from "@/utils/response.util.js";

// Import routes
import authRoutes from "@/routes/auth.routes.js";
import statsRoutes from "@/routes/stats.routes.js";
import logsRoutes from "@/routes/logs.routes.js";
import instancesRoutes from "@/routes/instances.routes.js";
import jobsRoutes from "@/routes/jobs.routes.js";
import systemRoutes from "@/routes/system.routes.js";

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
	app.use(jobsRoutes);
	app.use(systemRoutes);
};
