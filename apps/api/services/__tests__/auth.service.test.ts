import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { config as appConfig } from "@voltage/core/config";

describe("Auth Service", () => {
	let originalConfig: any;

	beforeEach(() => {
		// Store original config
		originalConfig = { ...appConfig.frontend };
		vi.clearAllMocks();
	});

	afterEach(() => {
		// Restore original config
		Object.assign(appConfig.frontend, originalConfig);
	});

	describe("authenticateFrontend", () => {
		it("should return null when authentication is not required", async () => {
			const { authenticateFrontend } = await import("../auth.service");

			appConfig.frontend.is_authentication_required = false;

			const result = authenticateFrontend("any-password");

			expect(result).toBeNull();
		});

		it("should throw PASSWORD_REQUIRED when password is empty", async () => {
			const { authenticateFrontend } = await import("../auth.service");

			appConfig.frontend.is_authentication_required = true;

			expect(() => authenticateFrontend("")).toThrow("PASSWORD_REQUIRED");
		});

		it("should throw PASSWORD_INVALID when password is incorrect", async () => {
			const { authenticateFrontend } = await import("../auth.service");

			appConfig.frontend.is_authentication_required = true;
			appConfig.frontend.password = "correctPassword";

			expect(() => authenticateFrontend("wrongPassword")).toThrow("PASSWORD_INVALID");
		});

		it("should return hash when password is correct", async () => {
			const { authenticateFrontend } = await import("../auth.service");

			appConfig.frontend.is_authentication_required = true;
			appConfig.frontend.password = "validPassword";

			const result = authenticateFrontend("validPassword");

			expect(result).toBeTruthy();
			expect(typeof result).toBe("string");
		});

		it("should return same hash for same password", async () => {
			const { authenticateFrontend } = await import("../auth.service");

			appConfig.frontend.is_authentication_required = true;
			appConfig.frontend.password = "testPassword";

			const hash1 = authenticateFrontend("testPassword");
			const hash2 = authenticateFrontend("testPassword");

			expect(hash1).toBe(hash2);
		});
	});
});
