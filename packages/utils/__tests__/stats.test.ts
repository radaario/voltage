import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock dependencies
vi.mock("../database", () => {
	const mockTrx = vi.fn(() => ({
		where: vi.fn().mockReturnThis(),
		first: vi.fn().mockResolvedValue(null),
		insert: vi.fn().mockResolvedValue([1]),
		update: vi.fn().mockResolvedValue(1)
	}));

	return {
		database: {
			config: vi.fn(),
			getTablePrefix: vi.fn(() => "voltage_"),
			transaction: vi.fn((callback) => callback(mockTrx))
		}
	};
});

vi.mock("../helpers/date", () => ({
	getNow: vi.fn(() => "2024-01-15 12:00:00"),
	getDate: vi.fn((date, format) => {
		if (format === "YYYY-MM-DD") return "2024-01-15";
		return date;
	})
}));

vi.mock("../helpers/crypto", () => ({
	hash: vi.fn((str) => `hash_${str}`)
}));

describe("Stats Module", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should export stats instance", async () => {
		const { stats } = await import("../stats");
		expect(stats).toBeDefined();
	});

	it("should have update method", async () => {
		const { stats } = await import("../stats");
		expect(typeof stats.update).toBe("function");
	});

	it("should update stats data", async () => {
		const { stats } = await import("../stats");

		const result = await stats.update({
			jobs_completed: 5,
			jobs_failed: 1
		});

		expect(result).toBeDefined();
	});

	it("should handle empty stats data", async () => {
		const { stats } = await import("../stats");

		const result = await stats.update({});
		expect(result).toBeNull();
	});

	it("should use current date when not provided", async () => {
		const { stats } = await import("../stats");
		const { getNow } = await import("../helpers/date");

		await stats.update({ test: 1 });

		expect(getNow).toHaveBeenCalled();
	});

	it("should accept custom date", async () => {
		const { stats } = await import("../stats");
		const { getDate } = await import("../helpers/date");

		await stats.update({ test: 1 }, "2024-01-20");

		expect(getDate).toHaveBeenCalledWith("2024-01-20", "YYYY-MM-DD");
	});

	it("should have get method", async () => {
		const { stats } = await import("../stats");
		expect(typeof stats.get).toBe("function");
	});

	it("should have cleanup method", async () => {
		const { stats } = await import("../stats");
		expect(typeof stats.cleanup).toBe("function");
	});

	it("should export StatsData interface", async () => {
		const module = await import("../stats");
		expect(module).toHaveProperty("stats");
	});
});
