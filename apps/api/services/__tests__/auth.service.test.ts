import { describe, it, expect, beforeEach, vi } from "vitest";
import { authenticateFrontend } from "../auth.service";

// Mock the config module
vi.mock("@voltage/core/config", () => {
	return {
		config: {
			frontend: {
				is_authentication_required: false,
				password: ""
			}
		}
	};
});

// Mock the hash function
vi.mock("@voltage/utils", () => {
	return {
		hash: (password: string) => `hashed_${password}`
	};
});

describe("Auth Service", () => {
	let mockConfig: any;

	beforeEach(async () => {
		vi.clearAllMocks();
		// Get the mocked config
		const configModule = await import("@voltage/core/config");
		mockConfig = configModule.config.frontend;
	});

	describe("authenticateFrontend", () => {
		it("should return null when authentication is not required", () => {
			mockConfig.is_authentication_required = false;

			const result = authenticateFrontend("any-password");

			expect(result).toBeNull();
		});

		it("should throw PASSWORD_REQUIRED when password is empty", () => {
			mockConfig.is_authentication_required = true;

			expect(() => authenticateFrontend("")).toThrow("PASSWORD_REQUIRED");
		});

		it("should throw PASSWORD_INVALID when password is incorrect", () => {
			mockConfig.is_authentication_required = true;
			mockConfig.password = "correctPassword";

			expect(() => authenticateFrontend("wrongPassword")).toThrow("PASSWORD_INVALID");
		});

		it("should return hash when password is correct", () => {
			mockConfig.is_authentication_required = true;
			mockConfig.password = "validPassword";

			const result = authenticateFrontend("validPassword");

			expect(result).toBeTruthy();
			expect(typeof result).toBe("string");
			expect(result).toBe("hashed_validPassword");
		});

		it("should return same hash for same password", () => {
			mockConfig.is_authentication_required = true;
			mockConfig.password = "testPassword";

			const result1 = authenticateFrontend("testPassword");
			const result2 = authenticateFrontend("testPassword");

			expect(result1).toBe(result2);
		});
	});
});
