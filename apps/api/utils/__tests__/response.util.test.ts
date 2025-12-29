import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendSuccess, sendError, sendPaginatedSuccess, responseMetadata } from "../response.util";

describe("Response Util", () => {
	let mockResponse: any;

	beforeEach(() => {
		mockResponse = {
			json: vi.fn().mockReturnThis(),
			status: vi.fn().mockReturnThis()
		};
	});

	describe("responseMetadata", () => {
		it("should contain version and env", () => {
			expect(responseMetadata).toHaveProperty("version");
			expect(responseMetadata).toHaveProperty("env");
		});
	});

	describe("sendSuccess", () => {
		it("should send success response with data", () => {
			const data = { id: 1, name: "test" };
			sendSuccess(mockResponse, data);

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: expect.objectContaining({
						status: "SUCCESSFUL"
					}),
					data
				})
			);
		});

		it("should send success response without data", () => {
			sendSuccess(mockResponse);

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: expect.objectContaining({
						status: "SUCCESSFUL"
					})
				})
			);
		});

		it("should include message when provided", () => {
			sendSuccess(mockResponse, null, {}, "Operation successful");

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: expect.objectContaining({
						message: "Operation successful"
					})
				})
			);
		});

		it("should merge additional metadata", () => {
			const additionalMetadata = { customField: "value" };
			sendSuccess(mockResponse, null, additionalMetadata);

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: expect.objectContaining({
						customField: "value"
					})
				})
			);
		});

		it("should include version and env in metadata", () => {
			sendSuccess(mockResponse);

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: expect.objectContaining({
						version: expect.any(String),
						env: expect.any(String)
					})
				})
			);
		});
	});

	describe("sendError", () => {
		it("should send error response with correct status code", () => {
			sendError(mockResponse, 404, "NOT_FOUND", "Resource not found");

			expect(mockResponse.status).toHaveBeenCalledWith(404);
			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: expect.objectContaining({
						status: "ERROR",
						error: {
							code: "NOT_FOUND",
							message: "Resource not found"
						}
					})
				})
			);
		});

		it("should handle different error codes and messages", () => {
			const testCases = [
				{ statusCode: 400, errorCode: "BAD_REQUEST", errorMessage: "Invalid input" },
				{ statusCode: 401, errorCode: "UNAUTHORIZED", errorMessage: "Not authenticated" },
				{ statusCode: 500, errorCode: "INTERNAL_ERROR", errorMessage: "Server error" }
			];

			testCases.forEach(({ statusCode, errorCode, errorMessage }) => {
				const mockRes = {
					json: vi.fn().mockReturnThis(),
					status: vi.fn().mockReturnThis()
				};

				sendError(mockRes, statusCode, errorCode, errorMessage);

				expect(mockRes.status).toHaveBeenCalledWith(statusCode);
				expect(mockRes.json).toHaveBeenCalledWith(
					expect.objectContaining({
						metadata: expect.objectContaining({
							error: { code: errorCode, message: errorMessage }
						})
					})
				);
			});
		});

		it("should include version and env in error metadata", () => {
			sendError(mockResponse, 500, "ERROR", "Test error");

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: expect.objectContaining({
						version: expect.any(String),
						env: expect.any(String)
					})
				})
			);
		});

		it("should merge additional metadata in error response", () => {
			const additionalMetadata = { requestId: "123" };
			sendError(mockResponse, 400, "ERROR", "Test", additionalMetadata);

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: expect.objectContaining({
						requestId: "123"
					})
				})
			);
		});
	});

	describe("sendPaginatedSuccess", () => {
		it("should send paginated response with correct structure", () => {
			const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
			const pagination = {
				limit: 10,
				page: 1,
				total: 50
			};

			sendPaginatedSuccess(mockResponse, data, pagination);

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: expect.objectContaining({
						status: "SUCCESSFUL"
					}),
					data,
					pagination: expect.objectContaining({
						limit: 10,
						page: 1,
						total: 50,
						total_pages: 5, // 50/10
						has_more: true, // Page 1 of 5, so there are more pages
						next_page: 2,
						prev_page: null
					})
				})
			);
		});

		it("should calculate totalPages correctly", () => {
			const testCases = [
				{ total: 50, limit: 10, expectedPages: 5 },
				{ total: 47, limit: 10, expectedPages: 5 },
				{ total: 10, limit: 10, expectedPages: 1 },
				{ total: 0, limit: 10, expectedPages: 0 }
			];

			testCases.forEach(({ total, limit, expectedPages }) => {
				const mockRes = {
					json: vi.fn().mockReturnThis(),
					status: vi.fn().mockReturnThis()
				};

				sendPaginatedSuccess(mockRes, [], { limit, page: 1, total });

				expect(mockRes.json).toHaveBeenCalledWith(
					expect.objectContaining({
						pagination: expect.objectContaining({
							total_pages: expectedPages
						})
					})
				);
			});
		});

		it("should include message when provided", () => {
			const pagination = { limit: 10, page: 1, total: 100 };
			const additionalMetadata = { message: "Data retrieved" };
			sendPaginatedSuccess(mockResponse, [], pagination, additionalMetadata);

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: expect.objectContaining({
						message: "Data retrieved"
					})
				})
			);
		});

		it("should handle empty data array", () => {
			const pagination = { limit: 10, page: 1, total: 0 };
			sendPaginatedSuccess(mockResponse, [], pagination);

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					data: [],
					pagination: expect.objectContaining({
						total: 0,
						total_pages: 0,
						has_more: false
					})
				})
			);
		});

		it("should set has_more and next_page when more pages exist", () => {
			const pagination = { limit: 10, page: 1, total: 50 };
			sendPaginatedSuccess(mockResponse, [], pagination);

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					pagination: expect.objectContaining({
						has_more: true,
						next_page: 2
					})
				})
			);
		});

		it("should set prev_page when not on first page", () => {
			const pagination = { limit: 10, page: 3, total: 50 };
			sendPaginatedSuccess(mockResponse, [], pagination);

			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					pagination: expect.objectContaining({
						prev_page: 2,
						page: 3
					})
				})
			);
		});
	});
});
