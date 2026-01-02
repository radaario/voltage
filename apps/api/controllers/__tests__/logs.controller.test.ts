import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";

vi.mock("@voltage/utils", () => ({
	sanitizeData: vi.fn((data) => data),
	logger: {
		insert: vi.fn().mockResolvedValue(undefined)
	}
}));

vi.mock("../../utils/response.util", () => ({
	sendSuccess: vi.fn((res, data) => {
		res.json({ success: true, data });
	}),
	sendError: vi.fn((res, status, code, message) => {
		res.status(status).json({ error: { code, message } });
	}),
	sendPaginatedSuccess: vi.fn((res, data, pagination) => {
		res.json({ success: true, data, pagination });
	})
}));

vi.mock("../../utils/pagination.util", () => ({
	getPaginationParams: vi.fn(() => ({
		limit: 10,
		page: 1,
		offset: 0
	}))
}));

vi.mock("../../services/logs.service", () => ({
	getLog: vi.fn(),
	getLogs: vi.fn(),
	deleteLogs: vi.fn()
}));

describe("Logs Controller", () => {
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

	describe("getLog", () => {
		it("should return log by key", async () => {
			const { getLog } = await import("../logs.controller");
			const { sendSuccess } = await import("../../utils/response.util");
			const logsService = await import("../../services/logs.service");

			const mockLog = {
				key: "log-1",
				type: "INFO",
				message: "Test log"
			};

			(logsService.getLog as any).mockResolvedValueOnce(mockLog);
			mockReq.query = { log_key: "log-1" };

			await getLog(mockReq as Request, mockRes as Response);

			expect(logsService.getLog).toHaveBeenCalledWith("log-1");
			expect(sendSuccess).toHaveBeenCalledWith(mockRes, mockLog);
		});

		it("should return 404 for non-existent log", async () => {
			const { getLog } = await import("../logs.controller");
			const { sendError } = await import("../../utils/response.util");
			const logsService = await import("../../services/logs.service");

			(logsService.getLog as any).mockRejectedValueOnce(new Error("NOT_FOUND"));
			mockReq.body = { log_key: "non-existent" };

			await getLog(mockReq as Request, mockRes as Response);

			expect(sendError).toHaveBeenCalledWith(mockRes, 404, "NOT_FOUND", "Log not found!");
		});

		it("should handle internal errors", async () => {
			const { getLog } = await import("../logs.controller");
			const { sendError } = await import("../../utils/response.util");
			const logsService = await import("../../services/logs.service");
			const { logger } = await import("@voltage/utils");

			const error = new Error("Database error");
			(logsService.getLog as any).mockRejectedValueOnce(error);
			mockReq.query = { log_key: "log-1" };

			await getLog(mockReq as Request, mockRes as Response);

			expect(logger.insert).toHaveBeenCalledWith("API", "ERROR", "Failed to fetch log!", { ...error });
			expect(sendError).toHaveBeenCalledWith(mockRes, 500, "INTERNAL_ERROR", "Database error");
		});
	});

	describe("getLogs", () => {
		it("should return paginated logs", async () => {
			const { getLogs } = await import("../logs.controller");
			const { sendPaginatedSuccess } = await import("../../utils/response.util");
			const logsService = await import("../../services/logs.service");

			const mockResult = {
				logs: [
					{ key: "log-1", type: "INFO" },
					{ key: "log-2", type: "ERROR" }
				],
				total: 2
			};

			(logsService.getLogs as any).mockResolvedValueOnce(mockResult);

			await getLogs(mockReq as Request, mockRes as Response);

			expect(sendPaginatedSuccess).toHaveBeenCalledWith(
				mockRes,
				mockResult.logs,
				expect.objectContaining({
					limit: 10,
					page: 1,
					total: 2
				})
			);
		});

		it("should filter logs by instance_key", async () => {
			const { getLogs } = await import("../logs.controller");
			const logsService = await import("../../services/logs.service");

			(logsService.getLogs as any).mockResolvedValueOnce({ logs: [], total: 0 });
			mockReq.query = { instance_key: "instance-1" };

			await getLogs(mockReq as Request, mockRes as Response);

			expect(logsService.getLogs).toHaveBeenCalledWith(
				expect.objectContaining({ limit: 10, page: 1, offset: 0 }),
				expect.objectContaining({ instance_key: "instance-1" })
			);
		});

		it("should filter logs by multiple criteria", async () => {
			const { getLogs } = await import("../logs.controller");
			const logsService = await import("../../services/logs.service");

			(logsService.getLogs as any).mockResolvedValueOnce({ logs: [], total: 0 });
			mockReq.query = {
				worker_key: "worker-1",
				job_key: "job-1",
				type: "ERROR",
				q: "search"
			};

			await getLogs(mockReq as Request, mockRes as Response);

			expect(logsService.getLogs).toHaveBeenCalledWith(
				expect.any(Object),
				expect.objectContaining({
					worker_key: "worker-1",
					job_key: "job-1",
					type: "ERROR",
					q: "search"
				})
			);
		});

		it("should delegate to getLog when log_key provided", async () => {
			const { getLogs } = await import("../logs.controller");
			const logsService = await import("../../services/logs.service");

			const mockLog = { key: "log-1", type: "INFO" };
			(logsService.getLog as any).mockResolvedValueOnce(mockLog);
			mockReq.body = { log_key: "log-1" };

			await getLogs(mockReq as Request, mockRes as Response);

			expect(logsService.getLog).toHaveBeenCalledWith("log-1");
		});

		it("should handle errors", async () => {
			const { getLogs } = await import("../logs.controller");
			const { sendError } = await import("../../utils/response.util");
			const logsService = await import("../../services/logs.service");
			const { logger } = await import("@voltage/utils");

			const error = new Error("Fetch failed");
			(logsService.getLogs as any).mockRejectedValueOnce(error);

			await getLogs(mockReq as Request, mockRes as Response);

			expect(logger.insert).toHaveBeenCalled();
			expect(sendError).toHaveBeenCalledWith(mockRes, 500, "INTERNAL_ERROR", "Fetch failed");
		});
	});

	describe("deleteLogs", () => {
		it("should delete all logs when all=true", async () => {
			const { deleteLogs } = await import("../logs.controller");
			const { sendSuccess } = await import("../../utils/response.util");
			const logsService = await import("../../services/logs.service");

			(logsService.deleteLogs as any).mockResolvedValueOnce({
				message: "All logs deleted"
			});

			mockReq.query = { all: "true" };

			await deleteLogs(mockReq as Request, mockRes as Response);

			expect(logsService.deleteLogs).toHaveBeenCalledWith(
				expect.objectContaining({
					all: "true",
					log_key: undefined,
					since_at: "",
					until_at: ""
				})
			);
			expect(sendSuccess).toHaveBeenCalledWith(mockRes, undefined, {}, "All logs deleted");
		});

		it("should delete logs by date range", async () => {
			const { deleteLogs } = await import("../logs.controller");
			const { sendSuccess } = await import("../../utils/response.util");
			const logsService = await import("../../services/logs.service");

			(logsService.deleteLogs as any).mockResolvedValueOnce({
				message: "Logs deleted",
				since_at: "2024-01-01",
				until_at: "2024-12-31"
			});

			mockReq.body = {
				since_at: "2024-01-01",
				until_at: "2024-12-31"
			};

			await deleteLogs(mockReq as Request, mockRes as Response);

			expect(logsService.deleteLogs).toHaveBeenCalledWith(
				expect.objectContaining({
					since_at: "2024-01-01",
					until_at: "2024-12-31"
				})
			);
			expect(sendSuccess).toHaveBeenCalledWith(
				mockRes,
				undefined,
				{ since_at: "2024-01-01", until_at: "2024-12-31" },
				"Logs deleted"
			);
		});

		it("should handle deletion errors", async () => {
			const { deleteLogs } = await import("../logs.controller");
			const { sendError } = await import("../../utils/response.util");
			const logsService = await import("../../services/logs.service");
			const { logger } = await import("@voltage/utils");

			const error = new Error("Delete failed");
			(logsService.deleteLogs as any).mockRejectedValueOnce(error);

			mockReq.query = { log_key: "log-1" };

			await deleteLogs(mockReq as Request, mockRes as Response);

			expect(logger.insert).toHaveBeenCalled();
			expect(sendError).toHaveBeenCalledWith(mockRes, 500, "INTERNAL_ERROR", "Delete failed");
		});
	});
});
