import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { database, logger, storage } from "@voltage/utils";
import { config as appConfig } from "@voltage/core/config";

// Mock dependencies
vi.mock("@voltage/utils", () => ({
	database: {
		table: vi.fn(),
		knex: {
			raw: vi.fn()
		}
	},
	logger: {
		console: vi.fn(),
		insert: vi.fn()
	},
	storage: {
		delete: vi.fn()
	},
	subtractNow: vi.fn((ms) => new Date(Date.now() - ms).toISOString())
}));

vi.mock("@voltage/core/config", () => ({
	config: {
		jobs: {
			retention: 24 * 60 * 60 * 1000 // 24 hours
		},
		stats: {
			retention: 365 * 24 * 60 * 60 * 1000 // 365 days
		},
		logs: {
			is_disabled: false,
			retention: 60 * 60 * 1000 // 1 hour
		}
	}
}));

describe("Cleanup Service", () => {
	let cleanupCompletedJobs: any;
	let cleanupStats: any;
	let cleanupLogs: any;

	beforeEach(async () => {
		vi.clearAllMocks();
		const module = await import("../cleanup.service.js");
		cleanupCompletedJobs = module.cleanupCompletedJobs;
		cleanupStats = module.cleanupStats;
		cleanupLogs = module.cleanupLogs;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("cleanupCompletedJobs", () => {
		it("should cleanup completed jobs when retention is configured", async () => {
			const mockQuery: any = {
				select: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				whereNotNull: vi.fn().mockReturnThis(),
				whereIn: vi.fn().mockReturnThis(),
				delete: vi.fn().mockResolvedValue(1)
			};

			// Mock the chain to return jobs on the final where call
			mockQuery.where.mockReturnValueOnce(mockQuery);
			mockQuery.whereNotNull.mockReturnValueOnce(mockQuery);
			mockQuery.where.mockResolvedValueOnce([{ key: "job1" }, { key: "job2" }]);

			(database.table as any).mockReturnValue(mockQuery);
			(storage.delete as any).mockResolvedValue(true);

			await cleanupCompletedJobs();

			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "Cleaning up completed jobs...");
			expect(storage.delete).toHaveBeenCalledWith("/jobs/job1");
			expect(storage.delete).toHaveBeenCalledWith("/jobs/job2");
			expect(mockQuery.delete).toHaveBeenCalled();
			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "Jobs cleaning completed!", { count: 2 });
		});

		it("should skip cleanup when retention is 0", async () => {
			(appConfig.jobs as any).retention = 0;

			await cleanupCompletedJobs();

			expect(database.table).not.toHaveBeenCalled();
			expect(logger.console).not.toHaveBeenCalled();

			(appConfig.jobs as any).retention = 24 * 60 * 60 * 1000;
		});

		it("should handle storage deletion errors gracefully", async () => {
			const mockQuery: any = {
				select: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				whereNotNull: vi.fn().mockReturnThis(),
				whereIn: vi.fn().mockReturnThis(),
				delete: vi.fn().mockResolvedValue(1)
			};

			// Mock the chain properly
			mockQuery.where.mockReturnValueOnce(mockQuery);
			mockQuery.whereNotNull.mockReturnValueOnce(mockQuery);
			mockQuery.where.mockResolvedValueOnce([{ key: "job1" }]);

			(database.table as any).mockReturnValue(mockQuery);
			(storage.delete as any).mockRejectedValue(new Error("Storage error"));

			await cleanupCompletedJobs();

			expect(storage.delete).toHaveBeenCalledWith("/jobs/job1");
			expect(mockQuery.delete).toHaveBeenCalled();
		});

		it("should not delete anything when no jobs match criteria", async () => {
			const mockQuery: any = {
				select: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				whereNotNull: vi.fn().mockReturnThis(),
				whereIn: vi.fn().mockReturnThis(),
				delete: vi.fn().mockResolvedValue(0)
			};

			// Mock the chain properly - should return empty array
			mockQuery.where.mockReturnValueOnce(mockQuery);
			mockQuery.whereNotNull.mockReturnValueOnce(mockQuery);
			mockQuery.where.mockResolvedValueOnce([]);

			(database.table as any).mockReturnValue(mockQuery);

			await cleanupCompletedJobs();

			expect(storage.delete).not.toHaveBeenCalled();
			expect(mockQuery.delete).not.toHaveBeenCalled();
		});
	});

	describe("cleanupStats", () => {
		it("should cleanup old stats when retention is configured", async () => {
			const mockQuery: any = {
				where: vi.fn().mockReturnThis(),
				delete: vi.fn().mockResolvedValue(10)
			};

			(database.table as any).mockReturnValue(mockQuery);

			await cleanupStats();

			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "Cleaning stats...");
			expect(mockQuery.delete).toHaveBeenCalled();
			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "Stats cleaning completed!");
		});
	});

	describe("cleanupLogs", () => {
		it("should cleanup old logs when retention is configured", async () => {
			const mockQuery: any = {
				where: vi.fn().mockReturnThis(),
				delete: vi.fn().mockResolvedValue(5)
			};

			(database.table as any).mockReturnValue(mockQuery);

			await cleanupLogs();

			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "Cleaning logs...");
			expect(mockQuery.where).toHaveBeenCalledWith("job_key", null);
			expect(mockQuery.delete).toHaveBeenCalled();
			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "Logs cleaning completed!");
		});
	});
});
