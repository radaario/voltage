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
	getDate: vi.fn((date: string) => date),
	subtractFrom: vi.fn(() => "2024-11-01"),
	getNow: vi.fn(() => "2024-12-01")
}));

describe("Stats Service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getStats", () => {
		it("should return stats with default date range", async () => {
			const mockStats = [
				{ date: "2024-11-01", total_jobs: 10 },
				{ date: "2024-12-01", total_jobs: 15 }
			];

			const mockQuery = {
				where: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockResolvedValue(mockStats)
			};

			mockDatabase.table.mockReturnValue(mockQuery);

			const { getStats } = await import("../stats.service");

			const result = await getStats();

			expect(result.stats).toEqual(mockStats);
			expect(result.since_at).toBeTruthy();
			expect(result.until_at).toBeTruthy();
			expect(mockDatabase.table).toHaveBeenCalledWith("stats");
		});

		it("should use provided date range", async () => {
			const mockQuery = {
				where: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockResolvedValue([])
			};

			mockDatabase.table.mockReturnValue(mockQuery);

			const { getStats } = await import("../stats.service");

			const result = await getStats("2024-01-01", "2024-06-01");

			expect(mockQuery.where).toHaveBeenCalledTimes(2);
			expect(result.since_at).toContain("2024-01-01");
			expect(result.until_at).toContain("2024-06-01");
		});
	});

	describe("deleteStats", () => {
		it("should delete all stats when all=true", async () => {
			const mockQuery = {
				delete: vi.fn().mockResolvedValue(undefined)
			};

			mockDatabase.table.mockReturnValue(mockQuery);

			const { deleteStats } = await import("../stats.service");

			const result = await deleteStats({ all: true });

			expect(mockQuery.delete).toHaveBeenCalled();
			expect(mockLogger.insert).toHaveBeenCalledWith("API", "WARNING", "All stats successfully deleted!");
			expect(result.message).toBe("All stats successfully deleted!");
		});

		it("should delete stats by stat_key", async () => {
			const mockQuery = {
				where: vi.fn().mockReturnThis(),
				delete: vi.fn().mockResolvedValue(undefined)
			};

			mockDatabase.table.mockReturnValue(mockQuery);

			const { deleteStats } = await import("../stats.service");

			const result = await deleteStats({ stat_key: "stat-1" });

			expect(mockQuery.where).toHaveBeenCalledWith("stat_key", "stat-1");
			expect(mockQuery.delete).toHaveBeenCalled();
			expect(result.message).toBe("Stats successfully deleted!");
		});

		it("should delete stats by date", async () => {
			const mockQuery = {
				where: vi.fn().mockReturnThis(),
				delete: vi.fn().mockResolvedValue(undefined)
			};

			mockDatabase.table.mockReturnValue(mockQuery);

			const { deleteStats } = await import("../stats.service");

			const result = await deleteStats({ date: "2024-06-01" });

			expect(mockQuery.where).toHaveBeenCalled();
			expect(mockQuery.delete).toHaveBeenCalled();
			expect(result.message).toBe("Some stats successfully deleted!");
		});

		it("should delete stats by date range", async () => {
			const mockQuery = {
				where: vi.fn().mockReturnThis(),
				delete: vi.fn().mockResolvedValue(undefined)
			};

			mockDatabase.table.mockReturnValue(mockQuery);

			const { deleteStats } = await import("../stats.service");

			const result = await deleteStats({
				since_at: "2024-01-01",
				until_at: "2024-06-01"
			});

			expect(mockQuery.where).toHaveBeenCalledTimes(2);
			expect(result.since_at).toBe("2024-01-01");
			expect(result.until_at).toBe("2024-06-01");
		});
	});
});
