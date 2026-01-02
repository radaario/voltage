import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";

vi.mock("@voltage/utils", () => ({
	sanitizeData: vi.fn((data) => data)
}));

vi.mock("../../utils/response.util", () => ({
	sendSuccess: vi.fn((res, data) => {
		res.json({ success: true, data });
	}),
	sendError: vi.fn((res, status, code, message) => {
		res.status(status).json({ error: { code, message } });
	})
}));

vi.mock("../../services/auth.service", () => ({
	authenticateFrontend: vi.fn()
}));

describe("Auth Controller", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;

	beforeEach(() => {
		mockReq = {
			query: {},
			body: {}
		};
		mockRes = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn()
		};
		vi.clearAllMocks();
	});

	describe("authenticate", () => {
		it("should return token when valid password provided", async () => {
			const { authenticate } = await import("../auth.controller");
			const { sendSuccess } = await import("../../utils/response.util");
			const authService = await import("../../services/auth.service");

			(authService.authenticateFrontend as any).mockReturnValueOnce("mock-token-hash");
			mockReq.query = { password: "validPassword" };

			await authenticate(mockReq as Request, mockRes as Response);

			expect(authService.authenticateFrontend).toHaveBeenCalledWith("validPassword");
			expect(sendSuccess).toHaveBeenCalledWith(mockRes, { token: "mock-token-hash" });
		});

		it("should return null when authentication not required", async () => {
			const { authenticate } = await import("../auth.controller");
			const { sendSuccess } = await import("../../utils/response.util");
			const authService = await import("../../services/auth.service");

			(authService.authenticateFrontend as any).mockReturnValueOnce(null);
			mockReq.query = { password: "" };

			await authenticate(mockReq as Request, mockRes as Response);

			expect(sendSuccess).toHaveBeenCalledWith(mockRes);
		});

		it("should handle PASSWORD_REQUIRED error", async () => {
			const { authenticate } = await import("../auth.controller");
			const { sendError } = await import("../../utils/response.util");
			const authService = await import("../../services/auth.service");

			(authService.authenticateFrontend as any).mockImplementationOnce(() => {
				throw new Error("PASSWORD_REQUIRED");
			});

			mockReq.body = { password: "" };

			await authenticate(mockReq as Request, mockRes as Response);

			expect(sendError).toHaveBeenCalledWith(mockRes, 400, "PASSWORD_REQUIRED", "Password required!");
		});

		it("should handle PASSWORD_INVALID error", async () => {
			const { authenticate } = await import("../auth.controller");
			const { sendError } = await import("../../utils/response.util");
			const authService = await import("../../services/auth.service");

			(authService.authenticateFrontend as any).mockImplementationOnce(() => {
				throw new Error("PASSWORD_INVALID");
			});

			mockReq.query = { password: "wrongPassword" };

			await authenticate(mockReq as Request, mockRes as Response);

			expect(sendError).toHaveBeenCalledWith(mockRes, 401, "PASSWORD_INVALID", "Invalid password!");
		});

		it("should accept password from body", async () => {
			const { authenticate } = await import("../auth.controller");
			const authService = await import("../../services/auth.service");

			(authService.authenticateFrontend as any).mockReturnValueOnce("token-from-body");
			mockReq.body = { password: "bodyPassword" };

			await authenticate(mockReq as Request, mockRes as Response);

			expect(authService.authenticateFrontend).toHaveBeenCalledWith("bodyPassword");
		});

		it("should trim password whitespace", async () => {
			const { authenticate } = await import("../auth.controller");
			const authService = await import("../../services/auth.service");

			(authService.authenticateFrontend as any).mockReturnValueOnce("trimmed-token");
			mockReq.query = { password: "  password123  " };

			await authenticate(mockReq as Request, mockRes as Response);

			expect(authService.authenticateFrontend).toHaveBeenCalledWith("password123");
		});

		it("should rethrow unknown errors", async () => {
			const { authenticate } = await import("../auth.controller");
			const authService = await import("../../services/auth.service");

			const unknownError = new Error("UNKNOWN_ERROR");
			(authService.authenticateFrontend as any).mockImplementationOnce(() => {
				throw unknownError;
			});

			mockReq.query = { password: "test" };

			await expect(authenticate(mockReq as Request, mockRes as Response)).rejects.toThrow("UNKNOWN_ERROR");
		});
	});
});
