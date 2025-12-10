import { describe, it, expect } from "vitest";
import { validateConfig, ConfigValidationError } from "../validators";
import { config } from "../index";

describe("Config Validators", () => {
	describe("validateConfig", () => {
		it("should validate loaded config successfully", () => {
			// Test that actual loaded config is valid
			expect(() => validateConfig(config)).not.toThrow();
		});

		it("should have valid app configuration", () => {
			expect(config.name).toBeDefined();
			expect(config.name.trim()).not.toBe("");
			expect(config.version).toBeDefined();
			expect(config.timezone).toBeDefined();
		});

		it("should have valid port configuration", () => {
			expect(config.port).toBeGreaterThan(0);
			expect(config.port).toBeLessThanOrEqual(65535);
		});

		it("should have valid storage configuration", () => {
			expect(config.storage.type).toBeDefined();
			expect(["LOCAL", "AWS_S3", "FTP", "SFTP", "OTHER_S3"]).toContain(config.storage.type);
		});

		it("should have valid database configuration", () => {
			expect(config.database.type).toBeDefined();
			expect(config.database.table_prefix).toBeDefined();
		});
	});

	describe("validation errors", () => {
		it("should detect ConfigValidationError type", () => {
			const error = new ConfigValidationError("Test error");
			expect(error).toBeInstanceOf(ConfigValidationError);
			expect(error).toBeInstanceOf(Error);
			expect(error.message).toBe("Test error");
		});

		it("should include error name in validation errors", () => {
			const error = new ConfigValidationError("Validation failed");
			expect(error.name).toBe("ConfigValidationError");
		});
	});

	describe("runtime configuration", () => {
		it("should have valid worker settings", () => {
			expect(config.runtime.workers.per_cpu_core).toBeGreaterThan(0);
			expect(config.runtime.workers.max).toBeGreaterThan(0);
		});

		it("should have valid instance settings", () => {
			expect(config.runtime.key_method).toBeDefined();
			// Don't check exact values, just that it's defined
			expect(typeof config.runtime.key_method).toBe("string");
		});
	});

	describe("jobs configuration", () => {
		it("should have valid timeout settings", () => {
			expect(config.jobs.queue_timeout).toBeGreaterThan(0);
			expect(config.jobs.process_timeout).toBeGreaterThan(0);
		});

		it("should have valid retry settings", () => {
			expect(config.jobs.try_min).toBeGreaterThanOrEqual(1);
			expect(config.jobs.try_max).toBeGreaterThanOrEqual(config.jobs.try_min);
		});

		it("should have valid enqueue settings", () => {
			expect(config.jobs.enqueue_limit).toBeGreaterThan(0);
		});
	});

	describe("utils configuration", () => {
		it("should have ffmpeg path configured", () => {
			expect(config.utils.ffmpeg.path).toBeDefined();
			expect(typeof config.utils.ffmpeg.path).toBe("string");
		});

		it("should have ffprobe path configured", () => {
			expect(config.utils.ffprobe.path).toBeDefined();
			expect(typeof config.utils.ffprobe.path).toBe("string");
		});

		it("should have whisper configuration if enabled", () => {
			if (config.utils.whisper) {
				expect(config.utils.whisper.model).toBeDefined();
				expect(typeof config.utils.whisper.cuda).toBe("boolean");
			} else {
				// Whisper might be optional or not configured
				expect(true).toBe(true);
			}
		});

		it("should have nsfw detection configuration if enabled", () => {
			if (config.utils.nsfw) {
				expect(config.utils.nsfw.model).toBeDefined();
			} else {
				// NSFW detection might be optional
				expect(true).toBe(true);
			}
		});
	});
});
