import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response, NextFunction } from "express";

// Mock dependencies
vi.mock("@voltage/core/config", () => ({
	config: {
		api: {
			auth_rate_limit: {
				window_ms: 60000, // 1 minute
				max_requests: 5
			}
		}
	}
}));

vi.mock("../../utils/response.util", () => ({
	sendError: vi.fn((res, status, code, message) => {
		res.status(status).json({ error: { code, message } });
		return res;
	})
}));

describe("Rate Limit Middleware", () => {
	let mockReq: Partial<Request> & { ip?: string };
	let mockRes: Partial<Response>;
	let mockNext: NextFunction;

	beforeEach(() => {
		vi.useFakeTimers();
		mockReq = {
			ip: "127.0.0.1",
			socket: { remoteAddress: "127.0.0.1" } as any
		};
		mockRes = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn(),
			setHeader: vi.fn()
		};
		mockNext = vi.fn();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("authRateLimitMiddleware", () => {
		it("should allow first request", async () => {
			const { authRateLimitMiddleware } = await import("../rate-limit.middleware");

			const middleware = authRateLimitMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should allow requests within limit", async () => {
			const { authRateLimitMiddleware } = await import("../rate-limit.middleware");

			const middleware = authRateLimitMiddleware();

			// Make 4 requests (within the limit of 5)
			for (let i = 0; i < 4; i++) {
				middleware(mockReq as Request, mockRes as Response, mockNext);
			}

			expect(mockNext).toHaveBeenCalledTimes(4);
		});

		it("should block requests exceeding limit", async () => {
			const { authRateLimitMiddleware } = await import("../rate-limit.middleware");
			const { sendError } = await import("../../utils/response.util");

			const middleware = authRateLimitMiddleware();

			// Make 5 requests (the limit)
			for (let i = 0; i < 5; i++) {
				middleware(mockReq as Request, mockRes as Response, mockNext);
			}

			// 6th request should be blocked
			vi.clearAllMocks();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(sendError).toHaveBeenCalledWith(
				mockRes,
				429,
				"RATE_LIMIT_EXCEEDED",
				expect.stringContaining("Too many authentication attempts")
			);
			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should set Retry-After header when rate limited", async () => {
			const { authRateLimitMiddleware } = await import("../rate-limit.middleware");

			const middleware = authRateLimitMiddleware();

			// Make 5 requests to reach limit
			for (let i = 0; i < 5; i++) {
				middleware(mockReq as Request, mockRes as Response, mockNext);
			}

			// Try one more
			vi.clearAllMocks();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockRes.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
		});

		it("should reset count after window expires", async () => {
			const { authRateLimitMiddleware } = await import("../rate-limit.middleware");

			const middleware = authRateLimitMiddleware();

			// Make 5 requests to reach limit
			for (let i = 0; i < 5; i++) {
				middleware(mockReq as Request, mockRes as Response, mockNext);
			}

			// Advance time past window
			vi.advanceTimersByTime(61000); // 61 seconds

			// Should allow new request
			vi.clearAllMocks();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should track different IPs separately", async () => {
			const { authRateLimitMiddleware } = await import("../rate-limit.middleware");

			const middleware = authRateLimitMiddleware();

			// Make 5 requests from first IP
			mockReq.ip = "127.0.0.1";
			for (let i = 0; i < 5; i++) {
				middleware(mockReq as Request, mockRes as Response, mockNext);
			}

			// Make request from different IP
			vi.clearAllMocks();
			mockReq.ip = "192.168.1.1";
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should handle unknown IP gracefully", async () => {
			const { authRateLimitMiddleware } = await import("../rate-limit.middleware");

			mockReq.ip = undefined;
			mockReq.socket = {} as any;

			const middleware = authRateLimitMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should use socket.remoteAddress as fallback", async () => {
			const { authRateLimitMiddleware } = await import("../rate-limit.middleware");

			mockReq.ip = undefined;
			mockReq.socket = { remoteAddress: "192.168.1.100" } as any;

			const middleware = authRateLimitMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});
	});
});
