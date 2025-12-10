import { describe, it, expect, vi, beforeEach } from "vitest";
import { timeoutQueuedJobs, enqueuePendingJobs } from "../jobs.service";
import { database, logger, getInstanceKey, getNow, subtractNow } from "@voltage/utils";
import { config } from "@voltage/config";

vi.mock("@voltage/utils", () => ({
	database: {
		table: vi.fn(),
		knex: {
			raw: vi.fn((sql: string) => sql)
		}
	},
	logger: {
		insert: vi.fn()
	},
	getInstanceKey: vi.fn(() => "test-instance-123"),
	getNow: vi.fn(() => "2024-01-15 10:00:00.000"),
	subtractNow: vi.fn()
}));

vi.mock("@voltage/config", () => ({
	config: {
		jobs: {
			queue_timeout: 5 * 60 * 1000, // 5 minutes
			enqueue_limit: 10
		}
	}
}));

vi.mock("@/services/workers.service.js", () => ({
	spawnInstanceWorkerForJob: vi.fn()
}));

vi.mock("@/worker/notifier.js", () => ({
	createJobNotification: vi.fn()
}));

describe("jobs.service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("timeoutQueuedJobs", () => {
		it("should timeout queued jobs that exceeded timeout threshold", async () => {
			const mockTable = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(2)
			};

			vi.mocked(database.table).mockReturnValue(mockTable as any);
			vi.mocked(getNow).mockReturnValue("2024-01-15 10:00:00.000");
			vi.mocked(subtractNow).mockReturnValue("2024-01-15 09:55:00.000");

			await timeoutQueuedJobs();

			expect(database.table).toHaveBeenCalledWith("jobs");
			expect(mockTable.where).toHaveBeenCalledWith("status", "QUEUED");
			expect(mockTable.where).toHaveBeenCalledWith("updated_at", "<=", "2024-01-15 09:55:00.000");
			expect(mockTable.update).toHaveBeenCalled();
		});

		it("should handle errors gracefully", async () => {
			const mockTable = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockRejectedValue(new Error("Database error"))
			};

			vi.mocked(database.table).mockReturnValue(mockTable as any);

			await expect(timeoutQueuedJobs()).resolves.not.toThrow();
		});
	});

	describe("enqueuePendingJobs", () => {
		it("should enqueue pending jobs within the limit", async () => {
			const mockTable = {
				where: vi.fn().mockReturnThis(),
				orWhere: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockReturnThis(),
				limit: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(5)
			};

			vi.mocked(database.table).mockReturnValue(mockTable as any);
			vi.mocked(getNow).mockReturnValue("2024-01-15 10:00:00.000");

			await enqueuePendingJobs();

			expect(database.table).toHaveBeenCalledWith("jobs");
			expect(mockTable.orderBy).toHaveBeenCalledWith("priority", "asc");
			expect(mockTable.orderBy).toHaveBeenCalledWith("created_at", "asc");
			expect(mockTable.limit).toHaveBeenCalledWith(10);
			expect(mockTable.update).toHaveBeenCalled();
		});

		it("should handle errors gracefully", async () => {
			const mockTable = {
				where: vi.fn().mockReturnThis(),
				orWhere: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockReturnThis(),
				limit: vi.fn().mockReturnThis(),
				update: vi.fn().mockRejectedValue(new Error("Database error"))
			};

			vi.mocked(database.table).mockReturnValue(mockTable as any);

			await expect(enqueuePendingJobs()).resolves.not.toThrow();
		});
	});
});
