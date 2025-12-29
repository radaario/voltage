import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEnv, getEnvOrNull, getEnvNumber, getEnvNumberOrNull, getEnvBoolean } from "../loader";

describe("Config Loader", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		// Create a fresh copy of env
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		// Restore original env
		process.env = originalEnv;
	});

	describe("getEnv", () => {
		it("should return environment variable value when set", () => {
			process.env.TEST_VAR = "test-value";
			expect(getEnv("TEST_VAR")).toBe("test-value");
		});

		it("should return fallback when environment variable is not set", () => {
			expect(getEnv("NON_EXISTENT_VAR", "fallback")).toBe("fallback");
		});

		it("should return empty string as default fallback", () => {
			expect(getEnv("NON_EXISTENT_VAR")).toBe("");
		});

		it("should handle empty string environment variable", () => {
			process.env.EMPTY_VAR = "";
			expect(getEnv("EMPTY_VAR", "fallback")).toBe("");
		});
	});

	describe("getEnvOrNull", () => {
		it("should return environment variable value when set", () => {
			process.env.TEST_VAR = "test-value";
			expect(getEnvOrNull("TEST_VAR", null)).toBe("test-value");
		});

		it("should return fallback when environment variable is not set", () => {
			expect(getEnvOrNull("NON_EXISTENT_VAR", null)).toBe(null);
			expect(getEnvOrNull("NON_EXISTENT_VAR", "fallback")).toBe("fallback");
		});

		it("should return null for empty string when set", () => {
			process.env.EMPTY_VAR = "";
			expect(getEnvOrNull("EMPTY_VAR", "fallback")).toBe(null);
		});
	});

	describe("getEnvNumber", () => {
		it("should parse valid number from environment variable", () => {
			process.env.PORT = "8080";
			expect(getEnvNumber("PORT", 3000)).toBe(8080);
		});

		it("should parse negative numbers", () => {
			process.env.NEGATIVE = "-100";
			expect(getEnvNumber("NEGATIVE", 0)).toBe(-100);
		});

		it("should parse decimal numbers", () => {
			process.env.DECIMAL = "3.14";
			expect(getEnvNumber("DECIMAL", 0)).toBe(3.14);
		});

		it("should return fallback for invalid number", () => {
			process.env.INVALID = "not-a-number";
			expect(getEnvNumber("INVALID", 3000)).toBe(3000);
		});

		it("should return fallback when environment variable is not set", () => {
			expect(getEnvNumber("NON_EXISTENT_VAR", 3000)).toBe(3000);
		});

		it("should return fallback for empty string", () => {
			process.env.EMPTY = "";
			expect(getEnvNumber("EMPTY", 3000)).toBe(3000);
		});
	});

	describe("getEnvNumberOrNull", () => {
		it("should parse valid number from environment variable", () => {
			process.env.PORT = "8080";
			expect(getEnvNumberOrNull("PORT", null)).toBe(8080);
		});

		it("should return null fallback for invalid number", () => {
			process.env.INVALID = "not-a-number";
			expect(getEnvNumberOrNull("INVALID", null)).toBe(null);
		});

		it("should return null when environment variable is not set", () => {
			expect(getEnvNumberOrNull("NON_EXISTENT_VAR", null)).toBe(null);
		});

		it("should return numeric fallback when provided", () => {
			expect(getEnvNumberOrNull("NON_EXISTENT_VAR", 100)).toBe(100);
		});
	});

	describe("getEnvBoolean", () => {
		it("should return true for 'true' string", () => {
			process.env.FEATURE_FLAG = "true";
			expect(getEnvBoolean("FEATURE_FLAG")).toBe(true);
		});

		it("should return true for 'TRUE' string (case insensitive)", () => {
			process.env.FEATURE_FLAG = "TRUE";
			expect(getEnvBoolean("FEATURE_FLAG")).toBe(true);
		});

		it("should return false for 'false' string", () => {
			process.env.FEATURE_FLAG = "false";
			expect(getEnvBoolean("FEATURE_FLAG", true)).toBe(false);
		});

		it("should return false for non-boolean strings", () => {
			process.env.FEATURE_FLAG = "yes";
			expect(getEnvBoolean("FEATURE_FLAG", true)).toBe(false);
		});

		it("should return fallback when environment variable is not set", () => {
			expect(getEnvBoolean("NON_EXISTENT_VAR", true)).toBe(true);
			expect(getEnvBoolean("NON_EXISTENT_VAR", false)).toBe(false);
		});

		it("should return false as default fallback", () => {
			expect(getEnvBoolean("NON_EXISTENT_VAR")).toBe(false);
		});

		it("should return fallback for empty string", () => {
			process.env.EMPTY = "";
			expect(getEnvBoolean("EMPTY", true)).toBe(true);
		});
	});
});
