import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";

vi.mock("@voltage/utils", () => ({
	sanitizeData: vi.fn((data) => data),
	logger: {
		insert: vi.fn().mockResolvedValue(undefined)
	}
}));

vi.mock("../../utils/response.util", () => ({
	sendSuccess: vi.fn((res, data, metadata, message) => {
		res.json({ success: true, data, metadata, message });
	}),
	sendError: vi.fn((res, status, code, message) => {
		res.status(status).json({ error: { code, message } });
	})
}));

vi.mock("../../services/stats.service", () => ({
	getStats: vi.fn(),
	deleteStats: vi.fn()
}));

describe("Stats Controller", () => {
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

	describe("getStats", () => {
		it("should return stats without date range", async () => {
			const { getStats } = await import("../stats.controller");
			const { sendSuccess } = await import("../../utils/response.util");
			const statsService = await import("../../services/stats.service");

			const mockResult = {
				stats: { total_jobs: 100, completed: 80 },
				since_at: "2024-01-01",
				until_at: "2024-12-31"
			};

			(statsService.getStats as any).mockResolvedValueOnce(mockResult);

			await getStats(mockReq as Request, mockRes as Response);

			expect(statsService.getStats).toHaveBeenCalledWith("", "");
			expect(sendSuccess).toHaveBeenCalledWith(mockRes, mockResult.stats, { since_at: "2024-01-01", until_at: "2024-12-31" });
		});

		it("should return stats with since_at date", async () => {
			const { getStats } = await import("../stats.controller");
			const statsService = await import("../../services/stats.service");

			const mockResult = {
				stats: { total_jobs: 50 },
				since_at: "2024-06-01",
				until_at: "2024-12-31"
			};

			(statsService.getStats as any).mockResolvedValueOnce(mockResult);
			mockReq.query = { since_at: "2024-06-01" };

			await getStats(mockReq as Request, mockRes as Response);

			expect(statsService.getStats).toHaveBeenCalledWith("2024-06-01", "");
		});

		it("should return stats with date range", async () => {
			const { getStats } = await import("../stats.controller");
			const statsService = await import("../../services/stats.service");

			const mockResult = {
				stats: { total_jobs: 25 },
				since_at: "2024-06-01",
				until_at: "2024-09-01"
			};

			(statsService.getStats as any).mockResolvedValueOnce(mockResult);
			mockReq.body = {
				since_at: "2024-06-01",
				until_at: "2024-09-01"
			};

			await getStats(mockReq as Request, mockRes as Response);

			expect(statsService.getStats).toHaveBeenCalledWith("2024-06-01", "2024-09-01");
		});

		it("should trim date parameters", async () => {
			const { getStats } = await import("../stats.controller");
			const statsService = await import("../../services/stats.service");

			(statsService.getStats as any).mockResolvedValueOnce({
				stats: {},
				since_at: "2024-01-01",
				until_at: "2024-12-31"
			});

			mockReq.query = {
				since_at: "  2024-01-01  ",
				until_at: "  2024-12-31  "
			};

			await getStats(mockReq as Request, mockRes as Response);

			expect(statsService.getStats).toHaveBeenCalledWith("2024-01-01", "2024-12-31");
		});

		it("should handle errors", async () => {
			const { getStats } = await import("../stats.controller");
			const { sendError } = await import("../../utils/response.util");
			const statsService = await import("../../services/stats.service");
			const { logger } = await import("@voltage/utils");

			const error = new Error("Stats fetch failed");
			(statsService.getStats as any).mockRejectedValueOnce(error);

			await getStats(mockReq as Request, mockRes as Response);

			expect(logger.insert).toHaveBeenCalledWith("API", "ERROR", "Failed to fetch stats!", { ...error });
			expect(sendError).toHaveBeenCalledWith(mockRes, 500, "INTERNAL_ERROR", "Stats fetch failed");
		});
	});

	describe("deleteStats", () => {
		it("should delete all stats when all=true", async () => {
			const { deleteStats } = await import("../stats.controller");
			const { sendSuccess } = await import("../../utils/response.util");
			const statsService = await import("../../services/stats.service");

			(statsService.deleteStats as any).mockResolvedValueOnce({
				message: "All stats deleted"
			});

			mockReq.query = { all: "true" };

			await deleteStats(mockReq as Request, mockRes as Response);

			expect(statsService.deleteStats).toHaveBeenCalledWith(
				expect.objectContaining({
					all: "true",
					stat_key: "",
					date: "",
					since_at: "",
					until_at: ""
				})
			);
			expect(sendSuccess).toHaveBeenCalledWith(mockRes, undefined, {}, "All stats deleted");
		});

		it("should delete stats by stat_key", async () => {
			const { deleteStats } = await import("../stats.controller");
			const statsService = await import("../../services/stats.service");

			(statsService.deleteStats as any).mockResolvedValueOnce({
				message: "Stat deleted"
			});

			mockReq.body = { stat_key: "stat-1" };

			await deleteStats(mockReq as Request, mockRes as Response);

			expect(statsService.deleteStats).toHaveBeenCalledWith(expect.objectContaining({ stat_key: "stat-1" }));
		});

		it("should delete stats by date", async () => {
			const { deleteStats } = await import("../stats.controller");
			const statsService = await import("../../services/stats.service");

			(statsService.deleteStats as any).mockResolvedValueOnce({
				message: "Stats deleted for date"
			});

			mockReq.query = { date: "2024-06-01" };

			await deleteStats(mockReq as Request, mockRes as Response);

			expect(statsService.deleteStats).toHaveBeenCalledWith(expect.objectContaining({ date: "2024-06-01" }));
		});

		it("should delete stats by date range", async () => {
			const { deleteStats } = await import("../stats.controller");
			const statsService = await import("../../services/stats.service");

			(statsService.deleteStats as any).mockResolvedValueOnce({
				message: "Stats deleted for range",
				since_at: "2024-01-01",
				until_at: "2024-06-01"
			});

			mockReq.body = {
				since_at: "2024-01-01",
				until_at: "2024-06-01"
			};

			await deleteStats(mockReq as Request, mockRes as Response);

			expect(statsService.deleteStats).toHaveBeenCalledWith(
				expect.objectContaining({
					since_at: "2024-01-01",
					until_at: "2024-06-01"
				})
			);
		});

		it("should include date metadata in response", async () => {
			const { deleteStats } = await import("../stats.controller");
			const { sendSuccess } = await import("../../utils/response.util");
			const statsService = await import("../../services/stats.service");

			(statsService.deleteStats as any).mockResolvedValueOnce({
				message: "Stats deleted",
				since_at: "2024-01-01",
				until_at: "2024-12-31"
			});

			mockReq.query = { all: "true" };

			await deleteStats(mockReq as Request, mockRes as Response);

			expect(sendSuccess).toHaveBeenCalledWith(
				mockRes,
				undefined,
				{ since_at: "2024-01-01", until_at: "2024-12-31" },
				"Stats deleted"
			);
		});

		it("should handle deletion errors", async () => {
			const { deleteStats } = await import("../stats.controller");
			const { sendError } = await import("../../utils/response.util");
			const statsService = await import("../../services/stats.service");
			const { logger } = await import("@voltage/utils");

			const error = new Error("Delete failed");
			(statsService.deleteStats as any).mockRejectedValueOnce(error);

			mockReq.query = { stat_key: "stat-1" };

			await deleteStats(mockReq as Request, mockRes as Response);

			expect(logger.insert).toHaveBeenCalledWith("API", "ERROR", "Failed to delete stats!", { ...error });
			expect(sendError).toHaveBeenCalledWith(mockRes, 500, "INTERNAL_ERROR", "Delete failed");
		});
	});
});
