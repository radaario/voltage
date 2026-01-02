import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response, NextFunction } from "express";

// Mock dependencies
vi.mock("@voltage/core/config", () => ({
	config: {
		frontend: {
			password: "test-password"
		},
		api: {
			key: "test-api-key"
		}
	}
}));

vi.mock("@voltage/utils", () => ({
	hash: vi.fn((str) => `hashed_${str}`)
}));

vi.mock("../../utils/response.util", () => ({
	sendError: vi.fn((res, status, code, message) => {
		res.status(status).json({ error: { code, message } });
	})
}));

describe("Auth Middleware", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
	let mockNext: NextFunction;

	beforeEach(() => {
		mockReq = {
			query: {},
			body: {},
			headers: {}
		};
		mockRes = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn()
		};
		mockNext = vi.fn();
		vi.clearAllMocks();
	});

	describe("authMiddleware", () => {
		it("should allow request with valid API key", async () => {
			const { authMiddleware } = await import("../auth.middleware");

			mockReq.headers = { "x-api-key": "test-api-key" };

			const middleware = authMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should allow request with Bearer token", async () => {
			const { authMiddleware } = await import("../auth.middleware");

			mockReq.headers = { authorization: "Bearer test-api-key" };

			const middleware = authMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should reject request without token", async () => {
			const { authMiddleware } = await import("../auth.middleware");
			const { sendError } = await import("../../utils/response.util");

			const middleware = authMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(sendError).toHaveBeenCalledWith(mockRes, 401, "AUTH_TOKEN_REQUIRED", expect.any(String));
		});

		it("should reject request with invalid token", async () => {
			const { authMiddleware } = await import("../auth.middleware");
			const { sendError } = await import("../../utils/response.util");

			mockReq.headers = { "x-api-key": "invalid-token" };

			const middleware = authMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(sendError).toHaveBeenCalledWith(mockRes, 401, "AUTH_TOKEN_INVALID", expect.any(String));
		});

		it("should check token from query parameter", async () => {
			const { authMiddleware } = await import("../auth.middleware");

			mockReq.query = { api_key: "test-api-key" };

			const middleware = authMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should check token from request body", async () => {
			const { authMiddleware } = await import("../auth.middleware");

			mockReq.body = { api_key: "test-api-key" };

			const middleware = authMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should allow frontend client with hashed password", async () => {
			const { authMiddleware } = await import("../auth.middleware");

			mockReq.query = { client: "FRONTEND" };
			mockReq.headers = { "x-api-key": "hashed_test-password" };

			const middleware = authMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});
	});

	describe("optionalAuthMiddleware", () => {
		it("should set isAuthenticated to true with valid token", async () => {
			const { optionalAuthMiddleware } = await import("../auth.middleware");

			mockReq.headers = { "x-api-key": "test-api-key" };

			const middleware = optionalAuthMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect((mockReq as any).isAuthenticated).toBe(true);
			expect(mockNext).toHaveBeenCalled();
		});

		it("should set isAuthenticated to false with invalid token", async () => {
			const { optionalAuthMiddleware } = await import("../auth.middleware");

			mockReq.headers = { "x-api-key": "invalid-token" };

			const middleware = optionalAuthMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect((mockReq as any).isAuthenticated).toBe(false);
			expect(mockNext).toHaveBeenCalled();
		});

		it("should set isAuthenticated to false without token", async () => {
			const { optionalAuthMiddleware } = await import("../auth.middleware");

			const middleware = optionalAuthMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect((mockReq as any).isAuthenticated).toBe(false);
			expect(mockNext).toHaveBeenCalled();
		});

		it("should always call next regardless of authentication", async () => {
			const { optionalAuthMiddleware } = await import("../auth.middleware");

			const middleware = optionalAuthMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});
	});
});
