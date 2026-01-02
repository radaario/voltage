import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../error.middleware.js";
import { logger } from "@voltage/utils";
import * as responseUtil from "@/utils/response.util.js";

vi.mock("@voltage/utils", () => ({
	logger: {
		insert: vi.fn()
	}
}));

vi.mock("@/utils/response.util.js", () => ({
	sendError: vi.fn()
}));

describe("Error Middleware", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
	let mockNext: NextFunction;

	beforeEach(() => {
		vi.clearAllMocks();
		mockReq = {};
		mockRes = {};
		mockNext = vi.fn();
	});

	describe("errorHandler", () => {
		it("should log the error to the logger", () => {
			const error = new Error("Test error");

			errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

			expect(logger.insert).toHaveBeenCalledWith("API", "ERROR", "An error occurred on API service!", {
				...error
			});
		});

		it("should call sendError with 500 status code", () => {
			const error = new Error("Test error");

			errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

			expect(responseUtil.sendError).toHaveBeenCalledWith(mockRes, 500, "INTERNAL_ERROR", "An error occurred on API service!");
		});

		it("should handle errors with additional properties", () => {
			const error = {
				message: "Custom error",
				statusCode: 404,
				customField: "custom value"
			};

			errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

			expect(logger.insert).toHaveBeenCalledWith("API", "ERROR", "An error occurred on API service!", {
				...error
			});
		});

		it("should handle string errors", () => {
			const error = "String error";

			errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

			expect(logger.insert).toHaveBeenCalled();
			expect(responseUtil.sendError).toHaveBeenCalled();
		});

		it("should handle null errors", () => {
			errorHandler(null, mockReq as Request, mockRes as Response, mockNext);

			expect(logger.insert).toHaveBeenCalledWith("API", "ERROR", "An error occurred on API service!", null);
			expect(responseUtil.sendError).toHaveBeenCalled();
		});

		it("should handle errors with stack traces", () => {
			const error = new Error("Test error with stack");
			error.stack = "Error: Test error\n    at test.js:1:1";

			errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

			expect(logger.insert).toHaveBeenCalledWith("API", "ERROR", "An error occurred on API service!", {
				...error
			});
		});

		it("should not call next function", () => {
			const error = new Error("Test error");

			errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should handle errors with circular references", () => {
			const error: any = { message: "Circular error" };
			error.self = error;

			errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

			expect(logger.insert).toHaveBeenCalled();
			expect(responseUtil.sendError).toHaveBeenCalled();
		});
	});
});
