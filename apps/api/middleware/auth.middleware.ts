import { Request, Response, NextFunction } from "express";
import { config } from "@voltage/config";
import { hash } from "@voltage/utils";
import { sendError } from "@/utils/response.util.js";

export const authMiddleware = (options: {} = {}) => {
	return (req: Request, res: Response, next: NextFunction) => {
		const client = req.query.client?.toString().toUpperCase() || null; // "FRONTEND"

		// Expected tokens
		const frontendToken = config.frontend.password ? hash(config.frontend.password) : null;
		const apiToken = client === "FRONTEND" ? frontendToken : config.api.key;

		if (!apiToken) {
			return next();
		}

		// Get token from various possible locations
		const token =
			req.query.token ||
			req.query.api_key ||
			req.body.token ||
			req.body.api_key ||
			req.headers.token ||
			req.headers.api_key ||
			req.headers["x-api-key"] ||
			(req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.substring(7) : null);

		if (!token) {
			return sendError(res, 401, "AUTH_TOKEN_REQUIRED", "Authentication token required!");
		}

		// Check if token matches either frontend token or API key
		if (token !== apiToken) {
			return sendError(res, 401, "AUTH_TOKEN_INVALID", "Invalid authentication token!");
		}

		next();
	};
};
