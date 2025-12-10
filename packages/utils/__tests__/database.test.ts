import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { database } from "../database";

// Mock knex
vi.mock("knex", () => ({
	default: vi.fn(() => ({
		schema: {
			hasTable: vi.fn(),
			createTable: vi.fn(),
			dropTable: vi.fn()
		},
		raw: vi.fn(),
		destroy: vi.fn(),
		transaction: vi.fn()
	}))
}));

describe("database", () => {
	describe("configuration", () => {
		it("should have config method", () => {
			expect(typeof database.config).toBe("function");
		});

		it("should have getTablePrefix method", () => {
			expect(typeof database.getTablePrefix).toBe("function");
		});
	});

	describe("table access", () => {
		it("should have table method", () => {
			expect(typeof database.table).toBe("function");
		});

		it("should have transaction method", () => {
			expect(typeof database.transaction).toBe("function");
		});

		it("should have hasTable method", () => {
			expect(typeof database.hasTable).toBe("function");
		});
	});
});
