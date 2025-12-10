import { describe, it, expect, beforeEach } from "vitest";
import { getEnv, getEnvNumber, getEnvBoolean } from "../loader";

describe("Config Loader", () => {
	describe("getEnv", () => {
		beforeEach(() => {
			delete process.env.TEST_VAR;
		});

		it("should return environment variable value", () => {
			process.env.TEST_VAR = "test-value";
			const result = getEnv("TEST_VAR");
			expect(result).toBe("test-value");
		});

		it("should return fallback when variable is not set", () => {
			const result = getEnv("NONEXISTENT_VAR", "fallback");
			expect(result).toBe("fallback");
		});

		it("should return empty string as default fallback", () => {
			const result = getEnv("NONEXISTENT_VAR");
			expect(result).toBe("");
		});

		it("should return actual value even if empty string", () => {
			process.env.EMPTY_VAR = "";
			const result = getEnv("EMPTY_VAR", "fallback");
			// Empty string is a valid value, not undefined
			expect(result).toBe("");
		});
	});

	describe("getEnvNumber", () => {
		beforeEach(() => {
			delete process.env.TEST_NUMBER;
		});

		it("should parse number from environment variable", () => {
			process.env.TEST_NUMBER = "42";
			const result = getEnvNumber("TEST_NUMBER", 0);
			expect(result).toBe(42);
		});

		it("should return fallback when variable is not set", () => {
			const result = getEnvNumber("NONEXISTENT_NUMBER", 99);
			expect(result).toBe(99);
		});

		it("should return fallback for invalid number", () => {
			process.env.TEST_NUMBER = "not-a-number";
			const result = getEnvNumber("TEST_NUMBER", 10);
			expect(result).toBe(10);
		});

		it("should handle negative numbers", () => {
			process.env.TEST_NUMBER = "-42";
			const result = getEnvNumber("TEST_NUMBER", 0);
			expect(result).toBe(-42);
		});

		it("should handle decimal numbers", () => {
			process.env.TEST_NUMBER = "3.14";
			const result = getEnvNumber("TEST_NUMBER", 0);
			expect(result).toBe(3.14);
		});

		it("should handle zero", () => {
			process.env.TEST_NUMBER = "0";
			const result = getEnvNumber("TEST_NUMBER", 99);
			expect(result).toBe(0);
		});
	});

	describe("getEnvBoolean", () => {
		beforeEach(() => {
			delete process.env.TEST_BOOL;
		});

		it("should parse true from environment variable", () => {
			process.env.TEST_BOOL = "true";
			const result = getEnvBoolean("TEST_BOOL", false);
			expect(result).toBe(true);
		});

		it("should parse TRUE (uppercase) as true", () => {
			process.env.TEST_BOOL = "TRUE";
			const result = getEnvBoolean("TEST_BOOL", false);
			expect(result).toBe(true);
		});

		it("should parse True (mixed case) as true", () => {
			process.env.TEST_BOOL = "True";
			const result = getEnvBoolean("TEST_BOOL", false);
			expect(result).toBe(true);
		});

		it("should return false for non-true values", () => {
			process.env.TEST_BOOL = "false";
			const result = getEnvBoolean("TEST_BOOL", true);
			expect(result).toBe(false);
		});

		it("should return fallback when variable is not set", () => {
			const result = getEnvBoolean("NONEXISTENT_BOOL", true);
			expect(result).toBe(true);
		});

		it("should return false as default fallback", () => {
			const result = getEnvBoolean("NONEXISTENT_BOOL");
			expect(result).toBe(false);
		});

		it('should handle "1" as non-true', () => {
			process.env.TEST_BOOL = "1";
			const result = getEnvBoolean("TEST_BOOL", false);
			expect(result).toBe(false);
		});

		it("should handle empty string", () => {
			process.env.TEST_BOOL = "";
			const result = getEnvBoolean("TEST_BOOL", true);
			// Empty string returns fallback (true in this case)
			expect(result).toBe(true);
		});
	});
});
