import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanupCompletedJobs, cleanupStats } from "../cleanup.service";
import { database, logger, storage, subtractNow } from "@voltage/utils";
import { config } from "@voltage/config";

vi.mock("@voltage/utils", () => ({
	database: {
		table: vi.fn(),
		knex: {
			raw: vi.fn()
		}
	},
	logger: {
		console: vi.fn()
	},
	storage: {
		delete: vi.fn()
	},
	subtractNow: vi.fn()
}));

vi.mock("@voltage/config", () => ({
	config: {
		jobs: {
			retention: 24 * 60 * 60 * 1000 // 24 hours
		},
		stats: {
			retention: 365 * 24 * 60 * 60 * 1000 // 365 days
		}
	}
}));

describe("cleanup.service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("cleanupCompletedJobs", () => {
		it("should cleanup completed jobs when retention is set", async () => {
			const mockJobs = [{ key: "job1" }, { key: "job2" }];
			const mockTable = {
				select: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				whereNotNull: vi.fn().mockReturnThis(),
				whereIn: vi.fn().mockReturnThis(),
				delete: vi.fn().mockResolvedValue(2)
			};

			vi.mocked(database.table).mockReturnValue(mockTable as any);
			vi.mocked(subtractNow).mockReturnValue("2024-01-01 00:00:00.000");
			mockTable.where.mockResolvedValue(mockJobs);
			vi.mocked(storage.delete).mockResolvedValue(undefined);

			await cleanupCompletedJobs();

			expect(database.table).toHaveBeenCalledWith("jobs");
			expect(mockTable.select).toHaveBeenCalledWith("key");
			expect(mockTable.where).toHaveBeenCalledWith("status", "COMPLETED");
			expect(storage.delete).toHaveBeenCalledWith("/jobs/job1");
			expect(storage.delete).toHaveBeenCalledWith("/jobs/job2");
			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "Jobs cleaning completed!", { count: 2 });
		});

		it("should skip cleanup when retention is 0", async () => {
			const originalRetention = config.jobs.retention;
			config.jobs.retention = 0;

			await cleanupCompletedJobs();

			expect(database.table).not.toHaveBeenCalled();

			config.jobs.retention = originalRetention;
		});

		it("should handle storage deletion errors gracefully", async () => {
			const mockJobs = [{ key: "job1" }];
			const mockTable = {
				select: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				whereNotNull: vi.fn().mockReturnThis(),
				whereIn: vi.fn().mockReturnThis(),
				delete: vi.fn().mockResolvedValue(1)
			};

			vi.mocked(database.table).mockReturnValue(mockTable as any);
			mockTable.where.mockResolvedValue(mockJobs);
			vi.mocked(storage.delete).mockRejectedValue(new Error("Storage error"));

			await cleanupCompletedJobs();

			expect(mockTable.delete).toHaveBeenCalled();
			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "Jobs cleaning completed!", { count: 1 });
		});
	});

	describe("cleanupStats", () => {
		it("should cleanup old stats when retention is set", async () => {
			const mockTable = {
				where: vi.fn().mockReturnThis(),
				delete: vi.fn().mockResolvedValue(50)
			};

			vi.mocked(database.table).mockReturnValue(mockTable as any);
			vi.mocked(subtractNow).mockReturnValue("2024-01-01 00:00:00.000");

			await cleanupStats();

			expect(database.table).toHaveBeenCalledWith("stats");
			expect(mockTable.where).toHaveBeenCalledWith("date", "<=", "2024-01-01 00:00:00.000");
			expect(mockTable.delete).toHaveBeenCalled();
			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "Stats cleaning completed!");
		});

		it("should skip cleanup when retention is 0", async () => {
			const originalRetention = config.stats.retention;
			config.stats.retention = 0;

			await cleanupStats();

			expect(database.table).not.toHaveBeenCalled();

			config.stats.retention = originalRetention;
		});
	});
});
