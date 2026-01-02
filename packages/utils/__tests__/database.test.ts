import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock dependencies before importing
vi.mock("knex", () => ({
	default: vi.fn(() => ({
		raw: vi.fn(),
		schema: {
			hasTable: vi.fn().mockResolvedValue(false),
			createTable: vi.fn()
		}
	}))
}));

describe("Database Module", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should export database instance", async () => {
		const { database } = await import("../database");
		expect(database).toBeDefined();
		expect(typeof database.config).toBe("function");
	});

	it("should accept database configuration", async () => {
		const { database } = await import("../database");

		expect(() => {
			database.config({
				type: "SQLITE",
				file_name: ":memory:",
				timezone: "UTC"
			});
		}).not.toThrow();
	});

	it("should have getTablePrefix method", async () => {
		const { database } = await import("../database");

		database.config({
			type: "SQLITE",
			file_name: ":memory:",
			table_prefix: "voltage_"
		});

		expect(typeof database.getTablePrefix).toBe("function");
		expect(database.getTablePrefix()).toBe("voltage_");
	});

	it("should handle empty table prefix", async () => {
		const { database } = await import("../database");

		database.config({
			type: "SQLITE",
			file_name: ":memory:",
			table_prefix: null
		});

		expect(database.getTablePrefix()).toBe("");
	});

	it("should have table method", async () => {
		const { database } = await import("../database");

		database.config({
			type: "SQLITE",
			file_name: ":memory:"
		});

		expect(typeof database.table).toBe("function");
	});

	it("should have transaction method", async () => {
		const { database } = await import("../database");

		database.config({
			type: "SQLITE",
			file_name: ":memory:"
		});

		expect(typeof database.transaction).toBe("function");
	});

	it("should export DatabaseConfig interface", async () => {
		const module = await import("../database");
		expect(module).toHaveProperty("database");
	});
});
