import { describe, it, expect } from "vitest";
import { isWindows, cpuCoresCount, getAppDir, getAppVersion } from "../system";
import os from "os";
import path from "path";

describe("System Helpers", () => {
	describe("isWindows", () => {
		it("should return boolean value", () => {
			expect(typeof isWindows).toBe("boolean");
		});

		it("should match os.platform check", () => {
			const expected = os.platform() === "win32";
			expect(isWindows).toBe(expected);
		});
	});

	describe("cpuCoresCount", () => {
		it("should return a positive number", () => {
			expect(cpuCoresCount).toBeGreaterThan(0);
		});

		it("should return an integer", () => {
			expect(Number.isInteger(cpuCoresCount)).toBe(true);
		});

		it("should match os.cpus().length", () => {
			const expected = os.cpus().length || 1;
			expect(cpuCoresCount).toBe(expected);
		});
	});

	describe("getAppDir", () => {
		it("should return absolute path", () => {
			const appDir = getAppDir();
			expect(path.isAbsolute(appDir)).toBe(true);
		});

		it("should return a string", () => {
			expect(typeof getAppDir()).toBe("string");
		});

		it("should return directory two levels up from cwd", () => {
			const expected = path.resolve(process.cwd(), "../..");
			expect(getAppDir()).toBe(expected);
		});
	});

	describe("getAppVersion", () => {
		it("should return a version string", () => {
			const version = getAppVersion();
			expect(typeof version).toBe("string");
			expect(version.length).toBeGreaterThan(0);
		});

		it("should return valid semver format or fallback", () => {
			const version = getAppVersion();
			// Should match semver pattern or be "1.0.0" fallback
			const semverPattern = /^\d+\.\d+\.\d+/;
			expect(semverPattern.test(version)).toBe(true);
		});

		it("should not throw error even if package.json is missing", () => {
			expect(() => getAppVersion()).not.toThrow();
		});
	});
});
