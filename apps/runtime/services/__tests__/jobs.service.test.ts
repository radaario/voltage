import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { database, logger, getInstanceKey } from "@voltage/utils";
import { config as appConfig } from "@voltage/core/config";

// Mock dependencies
vi.mock("@voltage/utils", () => ({
	database: {
		table: vi.fn(),
		knex: {
			raw: vi.fn((query) => query)
		}
	},
	logger: {
		console: vi.fn(),
		insert: vi.fn()
	},
	stats: {
		insert: vi.fn()
	},
	getInstanceKey: vi.fn(() => "test-instance-key"),
	getNow: vi.fn(() => "2025-01-01T00:00:00.000Z"),
	subtractNow: vi.fn((ms) => new Date(Date.now() - ms).toISOString())
}));

vi.mock("@voltage/core/config", () => ({
	config: {
		jobs: {
			queue_timeout: 5 * 60 * 1000, // 5 minutes
			enqueue_limit: 10
		}
	}
}));

vi.mock("@/worker/notifier.js", () => ({
	createJobNotification: vi.fn().mockResolvedValue(true)
}));

vi.mock("@/services/workers.service.js", () => ({
	spawnInstanceWorkerForJob: vi.fn().mockResolvedValue(true)
}));

describe("Jobs Service", () => {
	let timeoutQueuedJobs: any;
	let enqueuePendingJobs: any;

	beforeEach(async () => {
		vi.clearAllMocks();
		const module = await import("../jobs.service.js");
		timeoutQueuedJobs = module.timeoutQueuedJobs;
		enqueuePendingJobs = module.enqueuePendingJobs;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("timeoutQueuedJobs", () => {
		it("should timeout queued jobs that exceeded queue timeout", async () => {
			const mockQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(2)
			};

			(database.table as any).mockReturnValue(mockQuery);

			await timeoutQueuedJobs();

			expect(database.table).toHaveBeenCalledWith("jobs");
			expect(mockQuery.where).toHaveBeenCalledWith("status", "QUEUED");
			expect(mockQuery.update).toHaveBeenCalledWith(
				expect.objectContaining({
					started_at: null,
					completed_at: null,
					locked_by: null,
					retry_at: null
				})
			);
		});

		it("should handle timeout errors gracefully", async () => {
			const mockQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockRejectedValue(new Error("Database error"))
			};

			(database.table as any).mockReturnValue(mockQuery);

			await expect(timeoutQueuedJobs()).resolves.toBeUndefined();
		});
	});

	describe("enqueuePendingJobs", () => {
		it("should lock and enqueue pending jobs", async () => {
			const mockPendingJobs = [
				{ key: "job1", priority: 1, try_count: 0, created_at: "2025-01-01T00:00:00.000Z" },
				{ key: "job2", priority: 2, try_count: 1, created_at: "2025-01-01T00:01:00.000Z" }
			];

			const mockLockQuery: any = {
				where: vi.fn().mockReturnThis(),
				orWhere: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockReturnThis(),
				limit: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(2)
			};

			const mockSelectQuery: any = {
				where: vi.fn().mockResolvedValue(mockPendingJobs)
			};

			const mockUpdateQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(1)
			};

			const mockInsertQuery: any = {
				insert: vi.fn().mockResolvedValue([1])
			};

			(database.table as any)
				.mockReturnValueOnce(mockLockQuery)
				.mockReturnValueOnce(mockSelectQuery)
				.mockReturnValue(mockUpdateQuery);

			mockUpdateQuery.where.mockReturnValueOnce(mockUpdateQuery);
			mockUpdateQuery.update.mockResolvedValueOnce(1);
			mockInsertQuery.insert.mockImplementationOnce(() => {
				const { createJobNotification } = require("@/worker/notifier.js");
				return Promise.resolve([1]).then(async (result) => {
					await createJobNotification(mockPendingJobs[0], "QUEUED");
					return result;
				});
			});

			(database.table as any)
				.mockReturnValueOnce(mockLockQuery)
				.mockReturnValueOnce(mockSelectQuery)
				.mockReturnValueOnce(mockUpdateQuery)
				.mockReturnValueOnce(mockInsertQuery)
				.mockReturnValueOnce(mockUpdateQuery)
				.mockReturnValueOnce(mockInsertQuery);

			await enqueuePendingJobs();

			expect(mockLockQuery.update).toHaveBeenCalled();
			expect(mockSelectQuery.where).toHaveBeenCalledWith("locked_by", "test-instance-key");
		});

		it("should handle lock errors and log them", async () => {
			const mockQuery: any = {
				where: vi.fn().mockReturnThis(),
				orWhere: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockReturnThis(),
				limit: vi.fn().mockReturnThis(),
				update: vi.fn().mockRejectedValue(new Error("Lock failed"))
			};

			(database.table as any).mockReturnValue(mockQuery);

			await enqueuePendingJobs();

			expect(logger.insert).toHaveBeenCalledWith("INSTANCE", "ERROR", "Failed to select pending jobs!", expect.any(Object));
		});

		it.skip("should handle empty pending jobs list", async () => {
			const mockLockQuery: any = {
				where: vi.fn().mockReturnThis(),
				orWhere: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockReturnThis(),
				limit: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(1)
			};

			const mockSelectQuery: any = {
				where: vi.fn().mockResolvedValue([])
			};

			const mockReleaseQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(0)
			};

			(database.table as any)
				.mockReturnValueOnce(mockLockQuery)
				.mockReturnValueOnce(mockSelectQuery)
				.mockReturnValueOnce(mockReleaseQuery);

			await enqueuePendingJobs();

			expect(mockReleaseQuery.where).toHaveBeenCalledWith("locked_by", "test-instance-key");
			expect(mockReleaseQuery.update).toHaveBeenCalled();
		});
	});
});
