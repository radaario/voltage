import { Request, Response, NextFunction } from "express";
import { config } from "@voltage/config";
import { sendError } from "@/utils/response.util.js";

interface RateLimitRecord {
	count: number;
	resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup old entries periodically
setInterval(() => {
	const now = Date.now();
	for (const [key, record] of rateLimitStore.entries()) {
		if (now > record.resetTime) {
			rateLimitStore.delete(key);
		}
	}
}, 60000); // Clean up every minute

export const authRateLimitMiddleware = () => {
	return (req: Request, res: Response, next: NextFunction) => {
		// Get IP address
		const ip = req.ip || req.socket.remoteAddress || "unknown";
		const key = `auth:${ip}`;
		const now = Date.now();

		const windowMs = config.api.auth_rate_limit.window_ms;
		const maxRequests = config.api.auth_rate_limit.max_requests;

		// Get or create record
		let record = rateLimitStore.get(key);

		if (!record || now > record.resetTime) {
			// Create new record
			record = {
				count: 1,
				resetTime: now + windowMs
			};
			rateLimitStore.set(key, record);
			return next();
		}

		// Check if limit exceeded
		if (record.count >= maxRequests) {
			const retryAfterSecs = Math.ceil((record.resetTime - now) / 1000);
			const retryAfterMins = Math.ceil(retryAfterSecs / 60);
			res.setHeader("Retry-After", retryAfterSecs.toString());
			return sendError(
				res,
				429,
				"RATE_LIMIT_EXCEEDED",
				`Too many authentication attempts.\n Please try again in ${retryAfterMins} minutes.`
			);
		}

		// Increment count
		record.count++;
		return next();
	};
};
