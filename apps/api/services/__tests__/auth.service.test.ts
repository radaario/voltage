import { describe, it, expect, vi, beforeEach } from "vitest";
import { config } from "@voltage/config";
import { authenticateFrontend } from "../auth.service";

// Mock config
vi.mock("@voltage/config", () => ({
	config: {
		frontend: {
			is_authentication_required: true,
			password: "test-password-123"
		}
	}
}));

// Mock utils
vi.mock("@voltage/utils", () => ({
	hash: vi.fn((input) => `hashed_${input}`)
}));

describe("Auth Service", () => {
	beforeEach(() => {
		// Reset config to default mock values
		config.frontend.is_authentication_required = true;
		config.frontend.password = "test-password-123";
	});

	describe("authenticateFrontend", () => {
		it("should return null when authentication is not required", () => {
			config.frontend.is_authentication_required = false;

			const result = authenticateFrontend("any-password");
			expect(result).toBeNull();
		});

		it("should throw error when password is not provided", () => {
			expect(() => authenticateFrontend("")).toThrow("PASSWORD_REQUIRED");
		});

		it("should throw error when password is invalid", () => {
			expect(() => authenticateFrontend("wrong-password")).toThrow("PASSWORD_INVALID");
		});

		it("should return hashed password when credentials are valid", () => {
			const result = authenticateFrontend("test-password-123");
			expect(result).toBe("hashed_test-password-123");
		});

		it("should handle null password input", () => {
			expect(() => authenticateFrontend(null as any)).toThrow("PASSWORD_REQUIRED");
		});

		it("should handle undefined password input", () => {
			expect(() => authenticateFrontend(undefined as any)).toThrow("PASSWORD_REQUIRED");
		});
	});
});
