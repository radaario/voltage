import { Express, Request, Response } from "express";
import { config } from "@voltage/config";
import { sanitizeData } from "@voltage/utils";
import { sendSuccess } from "@/utils/response.util.js";
import { authMiddleware, optionalAuthMiddleware } from "@/middleware/auth.middleware.js";

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

	// Config endpoint - returns full config if authenticated, otherwise only frontend config
	app.get("/config", optionalAuthMiddleware(), async (req: Request, res: Response) => {
		const isAuthenticated = (req as any).isAuthenticated || false;
		const responseData = isAuthenticated ? config : { version: config.version, frontend: config.frontend };
		return sendSuccess(res, sanitizeData(responseData));
	});

	// Register all routes
	app.use(authRoutes);
	app.use(statsRoutes);
	app.use(logsRoutes);
	app.use(instancesRoutes);
	app.use(jobsRoutes);
	app.use(systemRoutes);
};
