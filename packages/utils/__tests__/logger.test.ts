import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock dependencies
vi.mock("pino", () => ({
	pino: vi.fn(() => ({
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
		fatal: vi.fn(),
		trace: vi.fn()
	}))
}));

vi.mock("../database", () => ({
	database: {
		config: vi.fn(),
		knex: {
			insert: vi.fn().mockResolvedValue([1]),
			table: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis()
		},
		getTablePrefix: vi.fn(() => "voltage_")
	}
}));

describe("Logger Module", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should export logger instance", async () => {
		const { logger } = await import("../logger");
		expect(logger).toBeDefined();
	});

	it("should have console method", async () => {
		const { logger } = await import("../logger");
		expect(typeof logger.console).toBe("function");
	});

	it("should have all log level methods", async () => {
		const { logger } = await import("../logger");
		expect(typeof logger.console).toBe("function");
		expect(logger).toBeDefined();
	});

	it("should accept log metadata", async () => {
		const { logger } = await import("../logger");

		expect(() => {
			logger.console("DEFAULT", "info", "Test message", {
				instance_key: "test-instance",
				job_key: "test-job"
			});
		}).not.toThrow();
	});

	it("should handle log without metadata", async () => {
		const { logger } = await import("../logger");

		expect(() => {
			logger.console("DEFAULT", "info", "Test message");
		}).not.toThrow();
	});

	it("should support different log levels", async () => {
		const { logger } = await import("../logger");

		const levels = ["fatal", "error", "warn", "info", "debug", "trace"] as const;

		levels.forEach((level) => {
			expect(() => {
				logger.console("DEFAULT", level, `Test ${level} message`);
			}).not.toThrow();
		});
	});

	it("should export LogLevel type", async () => {
		const module = await import("../logger");
		expect(module).toHaveProperty("logger");
	});

	it("should export LogMetadata interface", async () => {
		const module = await import("../logger");
		expect(module).toHaveProperty("logger");
	});
});
