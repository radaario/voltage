import { describe, it, expect, vi, beforeEach } from "vitest";
import { stats } from "../stats";
import { database } from "../database";

// Mock database
vi.mock("../database", () => ({
	database: {
		config: vi.fn(),
		getTablePrefix: vi.fn(() => "test_"),
		table: vi.fn(),
		transaction: vi.fn()
	}
}));

vi.mock("@voltage/config", () => ({
	config: {
		stats: {
			retention: 365 * 24 * 60 * 60 * 1000 // 365 days
		}
	}
}));

describe("stats", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("update", () => {
		it("should update stats for current date", async () => {
			const mockFirst = vi.fn().mockResolvedValue(null);
			const mockInsert = vi.fn().mockResolvedValue([1]);
			const mockWhere = vi.fn().mockReturnValue({
				first: mockFirst
			});
			const mockTrx = vi.fn((tableName: string) => ({
				where: mockWhere,
				first: mockFirst,
				insert: mockInsert
			}));

			vi.mocked(database.transaction).mockImplementation(async (callback: any) => {
				return callback(mockTrx);
			});

			await stats.update({ views: 10, clicks: 5 });

			expect(database.transaction).toHaveBeenCalled();
		});

		it("should increment existing stats", async () => {
			const mockUpdate = vi.fn().mockResolvedValue(1);
			const mockFirst = vi.fn().mockResolvedValue({
				date: "2024-01-15",
				data: JSON.stringify({ views: 100 })
			});

			const mockWhere = vi.fn().mockReturnValue({
				first: mockFirst,
				update: mockUpdate
			});

			const mockTrx = vi.fn((tableName: string) => ({
				where: mockWhere,
				first: mockFirst,
				update: mockUpdate
			}));

			vi.mocked(database.transaction).mockImplementation(async (callback: any) => {
				return callback(mockTrx);
			});

			await stats.update({ views: 10 });

			expect(mockUpdate).toHaveBeenCalled();
		});

		it("should return null for empty data", async () => {
			const result = await stats.update({});
			expect(result).toBeNull();
		});

		it("should handle custom date", async () => {
			const mockFirst = vi.fn().mockResolvedValue(null);
			const mockInsert = vi.fn().mockResolvedValue([1]);

			const mockWhere = vi.fn().mockReturnValue({
				first: mockFirst
			});

			const mockTrx = vi.fn((tableName: string) => ({
				where: mockWhere,
				first: mockFirst,
				insert: mockInsert
			}));

			vi.mocked(database.transaction).mockImplementation(async (callback: any) => {
				return callback(mockTrx);
			});

			await stats.update({ views: 1 }, "2024-01-15");

			expect(database.transaction).toHaveBeenCalled();
		});
	});

	describe("get", () => {
		it("should retrieve stats for a date", async () => {
			const mockStats = { date: "2024-01-15", data: JSON.stringify({ views: 100 }) };

			const mockFirst = vi.fn().mockResolvedValue(mockStats);
			const mockWhere = vi.fn().mockReturnValue({ first: mockFirst });

			vi.mocked(database.table).mockReturnValue({
				where: mockWhere
			} as any);

			const result = await stats.get("2024-01-15");

			expect(database.table).toHaveBeenCalledWith("stats");
			expect(result).toEqual({ views: 100 });
		});

		it("should parse JSON data correctly", async () => {
			const mockStats = { date: "2024-01-15", data: JSON.stringify({ views: 200, clicks: 50 }) };

			const mockFirst = vi.fn().mockResolvedValue(mockStats);
			const mockWhere = vi.fn().mockReturnValue({ first: mockFirst });

			vi.mocked(database.table).mockReturnValue({
				where: mockWhere
			} as any);

			const result = await stats.get("2024-01-15");

			expect(result).toEqual({ views: 200, clicks: 50 });
		});

		it("should handle empty results", async () => {
			const mockFirst = vi.fn().mockResolvedValue(null);
			const mockWhere = vi.fn().mockReturnValue({ first: mockFirst });

			vi.mocked(database.table).mockReturnValue({
				where: mockWhere
			} as any);

			const result = await stats.get("2024-01-01");

			expect(result).toBeNull();
		});
	});

	describe("cleanup", () => {
		it("should delete old stats", async () => {
			const mockDel = vi.fn().mockResolvedValue(50);
			const mockWhere = vi.fn().mockReturnValue({ del: mockDel });

			vi.mocked(database.table).mockReturnValue({
				where: mockWhere
			} as any);

			const deleted = await stats.cleanup();

			expect(database.table).toHaveBeenCalledWith("stats");
			expect(mockWhere).toHaveBeenCalled();
			expect(deleted).toBe(50);
		});

		it("should return 0 when no stats deleted", async () => {
			const mockDel = vi.fn().mockResolvedValue(0);
			const mockWhere = vi.fn().mockReturnValue({ del: mockDel });

			vi.mocked(database.table).mockReturnValue({
				where: mockWhere
			} as any);

			const deleted = await stats.cleanup();

			expect(deleted).toBe(0);
		});
	});
});
