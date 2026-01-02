import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { validateMiddleware } from "../validate.middleware.js";

vi.mock("@voltage/core/config", () => ({
	config: {
		version: "1.0.0",
		env: "test"
	}
}));

describe("Validate Middleware", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
	let mockNext: NextFunction;

	beforeEach(() => {
		vi.clearAllMocks();
		mockReq = {
			body: {},
			query: {},
			params: {}
		};
		mockRes = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn().mockReturnThis()
		};
		mockNext = vi.fn();
	});

	describe("validateMiddleware with body target", () => {
		it("should validate body and call next on valid data", () => {
			const schema = Joi.object({
				name: Joi.string().required(),
				age: Joi.number().required()
			});

			mockReq.body = { name: "John", age: 25 };

			const middleware = validateMiddleware(schema, "body");
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
			expect(mockRes.status).not.toHaveBeenCalled();
		});

		it("should return 400 error on invalid body data", () => {
			const schema = Joi.object({
				name: Joi.string().required(),
				age: Joi.number().required()
			});

			mockReq.body = { name: "John" }; // Missing age

			const middleware = validateMiddleware(schema, "body");
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).not.toHaveBeenCalled();
			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				metadata: {
					version: "1.0.0",
					env: "test",
					status: "ERROR",
					error: {
						code: "VALIDATION_ERROR",
						message: expect.stringContaining("age")
					}
				}
			});
		});

		it("should strip unknown fields", () => {
			const schema = Joi.object({
				name: Joi.string().required()
			});

			mockReq.body = { name: "John", unknown: "value" };

			const middleware = validateMiddleware(schema, "body");
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
			expect(mockReq.body).toEqual({ name: "John" });
		});

		it("should return multiple validation errors", () => {
			const schema = Joi.object({
				name: Joi.string().required(),
				email: Joi.string().email().required(),
				age: Joi.number().min(18).required()
			});

			mockReq.body = { name: "", email: "invalid", age: 10 };

			const middleware = validateMiddleware(schema, "body");
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).not.toHaveBeenCalled();
			expect(mockRes.status).toHaveBeenCalledWith(400);
			const jsonCall = (mockRes.json as any).mock.calls[0][0];
			expect(jsonCall.metadata.error.message).toContain(","); // Multiple errors joined
		});
	});

	describe("validateMiddleware with query target", () => {
		it("should validate query params", () => {
			const schema = Joi.object({
				page: Joi.number().required(),
				limit: Joi.number().required()
			});

			mockReq.query = { page: "1", limit: "10" };

			const middleware = validateMiddleware(schema, "query");
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should return error on invalid query params", () => {
			const schema = Joi.object({
				page: Joi.number().required()
			});

			mockReq.query = {}; // Missing page

			const middleware = validateMiddleware(schema, "query");
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).not.toHaveBeenCalled();
			expect(mockRes.status).toHaveBeenCalledWith(400);
		});
	});

	describe("validateMiddleware with params target", () => {
		it("should validate route params", () => {
			const schema = Joi.object({
				id: Joi.string().uuid().required()
			});

			mockReq.params = { id: "550e8400-e29b-41d4-a716-446655440000" };

			const middleware = validateMiddleware(schema, "params");
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should return error on invalid params", () => {
			const schema = Joi.object({
				id: Joi.string().uuid().required()
			});

			mockReq.params = { id: "invalid-uuid" };

			const middleware = validateMiddleware(schema, "params");
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).not.toHaveBeenCalled();
			expect(mockRes.status).toHaveBeenCalledWith(400);
		});
	});

	describe("validateMiddleware with multiple targets", () => {
		it("should validate multiple targets (body and query)", () => {
			const schema = Joi.object({
				name: Joi.string().required(),
				page: Joi.number().required()
			});

			mockReq.body = { name: "John" };
			mockReq.query = { page: "1" };

			const middleware = validateMiddleware(schema, ["body", "query"]);
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should validate multiple targets (query and params)", () => {
			const schema = Joi.object({
				id: Joi.string().required(),
				filter: Joi.string().required()
			});

			mockReq.params = { id: "123" };
			mockReq.query = { filter: "active" };

			const middleware = validateMiddleware(schema, ["params", "query"]);
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should validate all three targets", () => {
			const schema = Joi.object({
				id: Joi.string().required(),
				name: Joi.string().required(),
				page: Joi.number().required()
			});

			mockReq.params = { id: "123" };
			mockReq.body = { name: "John" };
			mockReq.query = { page: "1" };

			const middleware = validateMiddleware(schema, ["params", "body", "query"]);
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should redistribute validated values to targets", () => {
			const schema = Joi.object({
				name: Joi.string().required(),
				age: Joi.number().default(18)
			});

			mockReq.body = { name: "John" };

			const middleware = validateMiddleware(schema, "body");
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
			expect(mockReq.body).toHaveProperty("age", 18); // Default value applied
		});

		it("should return error if any target has invalid data", () => {
			const schema = Joi.object({
				id: Joi.string().required(),
				name: Joi.string().required()
			});

			mockReq.params = { id: "123" };
			mockReq.body = {}; // Missing name

			const middleware = validateMiddleware(schema, ["params", "body"]);
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).not.toHaveBeenCalled();
			expect(mockRes.status).toHaveBeenCalledWith(400);
		});
	});

	describe("validateMiddleware with default target", () => {
		it("should default to body target when no target specified", () => {
			const schema = Joi.object({
				name: Joi.string().required()
			});

			mockReq.body = { name: "John" };

			const middleware = validateMiddleware(schema);
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});
	});

	describe("validateMiddleware with complex schemas", () => {
		it("should validate nested objects", () => {
			const schema = Joi.object({
				user: Joi.object({
					name: Joi.string().required(),
					email: Joi.string().email().required()
				}).required()
			});

			mockReq.body = {
				user: {
					name: "John",
					email: "john@example.com"
				}
			};

			const middleware = validateMiddleware(schema, "body");
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should validate arrays", () => {
			const schema = Joi.object({
				tags: Joi.array().items(Joi.string()).required()
			});

			mockReq.body = {
				tags: ["tag1", "tag2", "tag3"]
			};

			const middleware = validateMiddleware(schema, "body");
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should validate with custom error messages", () => {
			const schema = Joi.object({
				password: Joi.string().min(8).required().messages({
					"string.min": "Password must be at least 8 characters long"
				})
			});

			mockReq.body = { password: "short" };

			const middleware = validateMiddleware(schema, "body");
			middleware(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).not.toHaveBeenCalled();
			expect(mockRes.status).toHaveBeenCalledWith(400);
			const jsonCall = (mockRes.json as any).mock.calls[0][0];
			expect(jsonCall.metadata.error.message).toContain("Password must be at least 8 characters long");
		});
	});
});
