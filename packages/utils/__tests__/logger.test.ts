import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../logger";
import { database } from "../database";

// Mock database
vi.mock("../database", () => ({
	database: {
		config: vi.fn(),
		table: vi.fn(() => ({
			insert: vi.fn().mockResolvedValue([1])
		}))
	}
}));

describe("logger", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("console logging", () => {
		it("should log to console with channel and level", () => {
			const pinoSpy = vi.spyOn((logger as any).pino, "info").mockImplementation(() => {});

			logger.console("TEST", "INFO", "Test message");

			expect(pinoSpy).toHaveBeenCalled();
			pinoSpy.mockRestore();
		});

		it("should handle metadata in console logs", () => {
			const pinoSpy = vi.spyOn((logger as any).pino, "info").mockImplementation(() => {});

			logger.console("TEST", "INFO", "Message with :key", { key: "value" });

			expect(pinoSpy).toHaveBeenCalled();
			pinoSpy.mockRestore();
		});

		it("should support all log levels", () => {
			const levels = ["INFO", "WARN", "ERROR", "DEBUG"];

			// Just verify logger.console doesn't throw for each level
			levels.forEach((level) => {
				expect(() => logger.console("TEST", level as any, `${level} message`)).not.toThrow();
			});
		});
	});
	describe("database logging", () => {
		it("should insert log into database", async () => {
			const mockInsert = vi.fn().mockResolvedValue([1]);
			vi.mocked(database.table).mockReturnValue({ insert: mockInsert } as any);

			await logger.insert("SYSTEM", "INFO", "Database log test");

			expect(database.table).toHaveBeenCalledWith("logs");
			expect(mockInsert).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "INFO",
					message: "Database log test"
				})
			);
		});

		it("should include metadata in database logs", async () => {
			const mockInsert = vi.fn().mockResolvedValue([1]);
			vi.mocked(database.table).mockReturnValue({ insert: mockInsert } as any);

			await logger.insert("JOB", "INFO", "Job :job_key started", {
				job_key: "test-job-123"
			});

			expect(mockInsert).toHaveBeenCalledWith(
				expect.objectContaining({
					job_key: "test-job-123",
					message: "Job test-job-123 started"
				})
			);
		});

		it("should handle errors gracefully", async () => {
			const mockInsert = vi.fn().mockRejectedValue(new Error("DB Error"));
			vi.mocked(database.table).mockReturnValue({ insert: mockInsert } as any);

			// Should not throw
			await expect(logger.insert("TEST", "ERROR", "Test")).resolves.not.toThrow();
		});
	});

	describe("message interpolation", () => {
		it("should replace placeholders with metadata values", async () => {
			const mockInsert = vi.fn().mockResolvedValue([1]);
			vi.mocked(database.table).mockReturnValue({ insert: mockInsert } as any);

			await logger.insert("TEST", "INFO", "User :user_id performed :action", {
				user_id: "123",
				action: "login"
			});

			const callArg = mockInsert.mock.calls[0][0];
			expect(callArg.message).toBe("User 123 performed login");
		});

		it("should handle missing metadata gracefully", async () => {
			const mockInsert = vi.fn().mockResolvedValue([1]);
			vi.mocked(database.table).mockReturnValue({ insert: mockInsert } as any);

			await logger.insert("TEST", "INFO", "Missing :placeholder");

			const callArg = mockInsert.mock.calls[0][0];
			// Placeholder without metadata value stays in message
			expect(callArg.message).toBe("Missing :placeholder");
		});
	});

	describe("log levels", () => {
		it("should accept all standard log levels", async () => {
			const levels: Array<"INFO" | "WARN" | "ERROR" | "DEBUG"> = ["INFO", "WARN", "ERROR", "DEBUG"];

			const mockInsert = vi.fn().mockResolvedValue([1]);
			vi.mocked(database.table).mockReturnValue({ insert: mockInsert } as any);

			for (const level of levels) {
				await logger.insert("TEST", level, `Test ${level}`);
			}

			expect(mockInsert).toHaveBeenCalledTimes(levels.length);
		});
	});
});
