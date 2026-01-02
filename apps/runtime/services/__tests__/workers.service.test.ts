import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { database, logger, getInstanceKey, hash, getNow } from "@voltage/utils";
import { config as appConfig } from "@voltage/core/config";

// Mock dependencies
vi.mock("@voltage/utils", () => ({
	database: {
		table: vi.fn(),
		knex: {
			raw: vi.fn((query, params) => query)
		}
	},
	logger: {
		console: vi.fn(),
		insert: vi.fn()
	},
	getInstanceKey: vi.fn(() => "test-instance-key"),
	hash: vi.fn((str) => `hash-${str}`),
	getNow: vi.fn(() => "2025-01-01T00:00:00.000Z"),
	subtractNow: vi.fn((ms) => new Date(Date.now() - ms).toISOString())
}));

vi.mock("@voltage/core/config", () => ({
	config: {
		runtime: {
			workers: {
				max: 5,
				busy_timeout: 5 * 60 * 1000,
				idle_after: 10 * 1000
			}
		}
	}
}));

describe("Workers Service", () => {
	let maintainInstanceWorkers: any;
	let timeoutBusyWorkers: any;
	let idleTimeoutWorkers: any;

	beforeEach(async () => {
		vi.clearAllMocks();
		const module = await import("../workers.service.js");
		maintainInstanceWorkers = module.maintainInstanceWorkers;
		timeoutBusyWorkers = module.timeoutBusyWorkers;
		idleTimeoutWorkers = module.idleTimeoutWorkers;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("maintainInstanceWorkers", () => {
		it("should create missing workers for instance", async () => {
			const mockCountQuery: any = {
				where: vi.fn().mockReturnThis(),
				count: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({ count: 2 })
			};

			const mockInsertQuery: any = {
				insert: vi.fn().mockResolvedValue([1, 2, 3])
			};

			const mockUpdateQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(5)
			};

			(database.table as any)
				.mockReturnValueOnce(mockCountQuery)
				.mockReturnValueOnce(mockInsertQuery)
				.mockReturnValueOnce(mockUpdateQuery);

			await maintainInstanceWorkers("test-instance-key");

			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "Maintaining instance workers...");
			expect(mockInsertQuery.insert).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						instance_key: "test-instance-key",
						status: "IDLE"
					})
				])
			);
			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "3 new workers initialized for instance!");
		});

		it("should not create workers when max workers already exist", async () => {
			const mockCountQuery: any = {
				where: vi.fn().mockReturnThis(),
				count: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({ count: 5 })
			};

			const mockUpdateQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(5)
			};

			(database.table as any).mockReturnValueOnce(mockCountQuery).mockReturnValueOnce(mockUpdateQuery);

			await maintainInstanceWorkers("test-instance-key");

			expect(database.table).toHaveBeenCalledTimes(2);
		});

		it("should update existing workers status", async () => {
			const mockCountQuery: any = {
				where: vi.fn().mockReturnThis(),
				count: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({ count: 3 })
			};

			const mockInsertQuery: any = {
				insert: vi.fn().mockResolvedValue([1, 2])
			};

			const mockUpdateQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(5)
			};

			(database.table as any)
				.mockReturnValueOnce(mockCountQuery)
				.mockReturnValueOnce(mockInsertQuery)
				.mockReturnValueOnce(mockUpdateQuery);

			await maintainInstanceWorkers("test-instance-key");

			expect(mockUpdateQuery.update).toHaveBeenCalledWith(
				expect.objectContaining({
					job_key: null,
					outcome: null
				})
			);
			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "Instance workers successfully maintained!");
		});

		it("should handle errors during worker maintenance", async () => {
			const mockCountQuery: any = {
				where: vi.fn().mockReturnThis(),
				count: vi.fn().mockReturnThis(),
				first: vi.fn().mockRejectedValue(new Error("Database error"))
			};

			(database.table as any).mockReturnValue(mockCountQuery);

			await maintainInstanceWorkers("test-instance-key");

			expect(logger.insert).toHaveBeenCalledWith(
				"INSTANCE",
				"ERROR",
				expect.stringContaining("workers maintenance failed"),
				expect.any(Object)
			);
		});

		it("should handle different instance keys", async () => {
			const mockCountQuery: any = {
				where: vi.fn().mockReturnThis(),
				count: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({ count: 5 })
			};

			const mockUpdateQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(5)
			};

			(database.table as any).mockReturnValueOnce(mockCountQuery).mockReturnValueOnce(mockUpdateQuery);

			await maintainInstanceWorkers("another-instance-key");

			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "Maintaining instance (another-instance-key) workers...");
		});
	});

	describe("timeoutBusyWorkers", () => {
		it("should timeout busy workers that exceeded timeout", async () => {
			const mockTimeoutWorkers = [
				{ key: "worker1", status: "BUSY", updated_at: "2024-12-31T23:00:00.000Z" },
				{ key: "worker2", status: "BUSY", updated_at: "2024-12-31T23:30:00.000Z" }
			];

			const mockQuery: any = {
				where: vi.fn().mockReturnThis(),
				whereIn: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(2)
			};
			// First where returns mockQuery, second where resolves with workers
			mockQuery.where.mockReturnValueOnce(mockQuery).mockResolvedValueOnce(mockTimeoutWorkers);

			(database.table as any).mockReturnValue(mockQuery);

			await timeoutBusyWorkers();

			expect(mockQuery.update).toHaveBeenCalledWith(
				expect.objectContaining({
					status: "TIMEOUT",
					outcome: JSON.stringify({ message: "Busy worker timed out!" })
				})
			);
		});

		it("should return undefined when no workers timeout", async () => {
			const mockSelectQuery: any = {
				where: vi.fn().mockReturnThis()
			};
			mockSelectQuery.where.mockResolvedValue([]);

			(database.table as any).mockReturnValue(mockSelectQuery);

			const result = await timeoutBusyWorkers();

			expect(result).toBeUndefined();
		});

		it("should handle timeout errors gracefully", async () => {
			const mockSelectQuery: any = {
				where: vi.fn().mockReturnThis()
			};
			mockSelectQuery.where.mockRejectedValue(new Error("Database error"));

			(database.table as any).mockReturnValue(mockSelectQuery);

			const result = await timeoutBusyWorkers();

			expect(logger.insert).toHaveBeenCalledWith("INSTANCE", "ERROR", "Timing out busy workers failed!", expect.any(Object));
			expect(result).toBeUndefined();
		});
	});

	describe("idleTimeoutWorkers", () => {
		it("should timeout idle workers that exceeded idle timeout", async () => {
			const mockQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(2)
			};
			mockQuery.where.mockReturnValueOnce(mockQuery).mockReturnValueOnce(mockQuery);
			(database.table as any).mockReturnValue(mockQuery);
			await idleTimeoutWorkers();
			expect(mockQuery.update).toHaveBeenCalled();
		});

		it("should handle empty idle workers list", async () => {
			const mockQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(0)
			};
			mockQuery.where.mockReturnValueOnce(mockQuery).mockReturnValueOnce(mockQuery);

			(database.table as any).mockReturnValue(mockQuery);

			await idleTimeoutWorkers();

			expect(mockQuery.update).toHaveBeenCalled();
		});

		it("should handle errors gracefully", async () => {
			const mockQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockRejectedValue(new Error("Database error"))
			};

			(database.table as any).mockReturnValue(mockQuery);

			await idleTimeoutWorkers();

			expect(logger.insert).toHaveBeenCalledWith(
				"INSTANCE",
				"ERROR",
				"The worker timed out and could not be updated!",
				expect.any(Object)
			);
		});
	});
});
