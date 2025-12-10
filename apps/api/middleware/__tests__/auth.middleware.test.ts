import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import { authMiddleware, optionalAuthMiddleware } from "../auth.middleware";

// Mock dependencies
vi.mock("@voltage/config", () => ({
	config: {
		frontend: {
			password: "frontend-password"
		},
		api: {
			key: "test-api-key"
		}
	}
}));

vi.mock("@voltage/utils", () => ({
	hash: vi.fn((input) => `hashed_${input}`)
}));

vi.mock("@/utils/response.util.js", () => ({
	sendError: vi.fn((res, code, type, message) => {
		res.status(code).json({ error: type, message });
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
			json: vi.fn().mockReturnThis()
		};
		mockNext = vi.fn();
	});

	describe("authMiddleware", () => {
		it("should call next() when valid API key is provided in headers", () => {
			mockReq.headers = { "x-api-key": "test-api-key" };

			const middleware = authMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should call next() when valid token is in query string", () => {
			mockReq.query = { token: "test-api-key" };

			const middleware = authMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should call next() when valid token is in body", () => {
			mockReq.body = { api_key: "test-api-key" };

			const middleware = authMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should call next() when valid Bearer token is provided", () => {
			mockReq.headers = {
				authorization: "Bearer test-api-key"
			};

			const middleware = authMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should return 401 when no token is provided", () => {
			const middleware = authMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockRes.status).toHaveBeenCalledWith(401);
			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should return 401 when invalid token is provided", () => {
			mockReq.headers = { "x-api-key": "invalid-key" };

			const middleware = authMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockRes.status).toHaveBeenCalledWith(401);
			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should validate frontend token when client is FRONTEND", () => {
			mockReq.query = {
				client: "FRONTEND",
				token: "hashed_frontend-password"
			};

			const middleware = authMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should handle lowercase client parameter", () => {
			mockReq.query = {
				client: "frontend",
				token: "hashed_frontend-password"
			};

			const middleware = authMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});
	});

	describe("optionalAuthMiddleware", () => {
		it("should set isAuthenticated to true with valid token", () => {
			mockReq.headers = { "x-api-key": "test-api-key" };

			const middleware = optionalAuthMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect((mockReq as any).isAuthenticated).toBe(true);
			expect(mockNext).toHaveBeenCalled();
		});

		it("should set isAuthenticated to false with invalid token", () => {
			mockReq.headers = { "x-api-key": "invalid-key" };

			const middleware = optionalAuthMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect((mockReq as any).isAuthenticated).toBe(false);
			expect(mockNext).toHaveBeenCalled();
		});

		it("should set isAuthenticated to false when no token provided", () => {
			const middleware = optionalAuthMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect((mockReq as any).isAuthenticated).toBe(false);
			expect(mockNext).toHaveBeenCalled();
		});

		it("should always call next() regardless of auth status", () => {
			mockReq.headers = { "x-api-key": "wrong-key" };

			const middleware = optionalAuthMiddleware();
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});
	});
});
