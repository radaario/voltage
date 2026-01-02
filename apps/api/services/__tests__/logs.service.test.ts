import { describe, it, expect, beforeEach, vi } from "vitest";

const mockDatabase = {
	table: vi.fn()
};

const mockLogger = {
	insert: vi.fn().mockResolvedValue(undefined)
};

vi.mock("@voltage/utils", () => ({
	database: mockDatabase,
	logger: mockLogger,
	getDate: vi.fn((date: string) => date)
}));

describe("Logs Service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getLog", () => {
		it("should throw NOT_FOUND when log does not exist", async () => {
			const mockQuery = {
				where: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue(null)
			};

			mockDatabase.table.mockReturnValue(mockQuery);

			const { getLog } = await import("../logs.service");

			await expect(getLog("non-existent")).rejects.toThrow("NOT_FOUND");
			expect(mockDatabase.table).toHaveBeenCalledWith("logs");
			expect(mockQuery.where).toHaveBeenCalledWith("key", "non-existent");
		});

		it("should return log when found", async () => {
			const mockLog = {
				key: "log-1",
				type: "INFO",
				message: "Test log"
			};

			const mockQuery = {
				where: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue(mockLog)
			};

			mockDatabase.table.mockReturnValue(mockQuery);

			const { getLog } = await import("../logs.service");

			const result = await getLog("log-1");

			expect(result).toEqual(mockLog);
		});
	});

	describe("getLogs", () => {
		it("should return paginated logs", async () => {
			const mockLogs = [
				{ key: "log-1", type: "INFO" },
				{ key: "log-2", type: "ERROR" }
			];

			const mockQuery = {
				where: vi.fn().mockReturnThis(),
				clone: vi.fn().mockReturnThis(),
				count: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({ total: 2 }),
				orderBy: vi.fn().mockReturnThis(),
				limit: vi.fn().mockReturnThis(),
				offset: vi.fn().mockResolvedValue(mockLogs)
			};

			mockDatabase.table.mockReturnValue(mockQuery);

			const { getLogs } = await import("../logs.service");

			const result = await getLogs({ limit: 10, page: 1, offset: 0 }, { type: "INFO" });

			expect(result.logs).toEqual(mockLogs);
			expect(result.total).toBe(2);
			expect(mockQuery.where).toHaveBeenCalledWith("type", "INFO");
		});

		it("should apply multiple filters", async () => {
			const mockQuery = {
				where: vi.fn().mockReturnThis(),
				clone: vi.fn().mockReturnThis(),
				count: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({ total: 0 }),
				orderBy: vi.fn().mockReturnThis(),
				limit: vi.fn().mockReturnThis(),
				offset: vi.fn().mockResolvedValue([])
			};

			mockDatabase.table.mockReturnValue(mockQuery);

			const { getLogs } = await import("../logs.service");

			await getLogs(
				{ limit: 10, page: 1, offset: 0 },
				{
					instance_key: "instance-1",
					worker_key: "worker-1",
					job_key: "job-1",
					type: "ERROR"
				}
			);

			expect(mockQuery.where).toHaveBeenCalledWith("type", "ERROR");
			expect(mockQuery.where).toHaveBeenCalledWith("instance_key", "instance-1");
			expect(mockQuery.where).toHaveBeenCalledWith("worker_key", "worker-1");
			expect(mockQuery.where).toHaveBeenCalledWith("job_key", "job-1");
		});
	});

	describe("deleteLogs", () => {
		it("should delete all logs when all=true", async () => {
			const mockQuery = {
				delete: vi.fn().mockResolvedValue(undefined)
			};

			mockDatabase.table.mockReturnValue(mockQuery);

			const { deleteLogs } = await import("../logs.service");

			const result = await deleteLogs({ all: true });

			expect(mockQuery.delete).toHaveBeenCalled();
			expect(mockLogger.insert).toHaveBeenCalledWith("API", "WARNING", "All logs successfully deleted!");
			expect(result.message).toBe("All logs successfully deleted!");
		});

		it("should delete log by key", async () => {
			const mockQuery = {
				where: vi.fn().mockReturnThis(),
				delete: vi.fn().mockResolvedValue(undefined)
			};

			mockDatabase.table.mockReturnValue(mockQuery);

			const { deleteLogs } = await import("../logs.service");

			const result = await deleteLogs({ log_key: "log-1" });

			expect(mockQuery.where).toHaveBeenCalledWith("key", "log-1");
			expect(mockQuery.delete).toHaveBeenCalled();
			expect(result.message).toBe("Log successfully deleted!");
		});

		it("should delete logs by date range", async () => {
			const mockQuery = {
				where: vi.fn().mockReturnThis(),
				delete: vi.fn().mockResolvedValue(undefined)
			};

			mockDatabase.table.mockReturnValue(mockQuery);

			const { deleteLogs } = await import("../logs.service");

			const result = await deleteLogs({
				since_at: "2024-01-01",
				until_at: "2024-12-31"
			});

			expect(mockQuery.where).toHaveBeenCalledTimes(2);
			expect(result.since_at).toBe("2024-01-01");
			expect(result.until_at).toBe("2024-12-31");
		});
	});
});
