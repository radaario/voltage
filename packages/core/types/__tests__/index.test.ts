import { describe, it, expect } from "vitest";
import type { STORAGE_TYPE, DATABASE_TYPE, FFMPEG_PRESET, NSFW_MODEL, WHISPER_MODEL, JobConfig, JobInput } from "../index";

describe("Types", () => {
	describe("Type definitions", () => {
		it("should allow valid STORAGE_TYPE values", () => {
			const storageTypes: STORAGE_TYPE[] = ["LOCAL", "AWS_S3", "FTP", "SFTP"];
			expect(storageTypes).toBeDefined();
		});

		it("should allow valid DATABASE_TYPE values", () => {
			const databaseTypes: DATABASE_TYPE[] = ["SQLITE", "MYSQL", "POSTGRESQL"];
			expect(databaseTypes).toBeDefined();
		});

		it("should allow valid FFMPEG_PRESET values", () => {
			const presets: FFMPEG_PRESET[] = ["DEFAULT", "ULTRA_FAST", "MEDIUM", "SLOW"];
			expect(presets).toBeDefined();
		});

		it("should allow valid NSFW_MODEL values", () => {
			const models: NSFW_MODEL[] = ["MOBILE_NET_V2", "INCEPTION_V3"];
			expect(models).toBeDefined();
		});

		it("should allow valid WHISPER_MODEL values", () => {
			const models: WHISPER_MODEL[] = ["BASE", "SMALL", "MEDIUM"];
			expect(models).toBeDefined();
		});
	});

	describe("JobConfig type", () => {
		it("should accept valid job config", () => {
			const config: JobConfig = {
				voltage_version: "1.0.0",
				input_analysis: true,
				preview_generation: true,
				nsfw_detection: false,
				ffmpeg_threads: 4,
				ffmpeg_preset: "MEDIUM",
				ffmpeg_quality: 80,
				nsfw_model: "MOBILE_NET_V2",
				nsfw_threshold: 0.6,
				whisper_model: "BASE",
				whisper_with_cuda: false
			};
			expect(config).toBeDefined();
			expect(config.ffmpeg_preset).toBe("MEDIUM");
		});

		it("should accept partial job config", () => {
			const config: JobConfig = {
				ffmpeg_preset: "FAST"
			};
			expect(config).toBeDefined();
		});

		it("should accept empty job config", () => {
			const config: JobConfig = {};
			expect(config).toBeDefined();
		});

		it("should accept null values for optional numeric fields", () => {
			const config: JobConfig = {
				ffmpeg_threads: null,
				ffmpeg_quality: null,
				ffmpeg_bit_rate_min: null,
				ffmpeg_bit_rate_max: null
			};
			expect(config).toBeDefined();
		});
	});

	describe("JobInput type", () => {
		it("should accept BASE64 input type", () => {
			const input: JobInput = {
				type: "BASE64",
				name: "video.mp4",
				content: "base64encodedcontent"
			};
			expect(input.type).toBe("BASE64");
		});

		it("should accept HTTP input type", () => {
			const input: JobInput = {
				type: "HTTP",
				url: "https://example.com/video.mp4"
			};
			expect(input.type).toBe("HTTP");
		});

		it("should accept HTTP input with optional fields", () => {
			const input: JobInput = {
				type: "HTTP",
				url: "https://example.com/video.mp4",
				method: "GET",
				agent: "Custom Agent",
				headers: {
					Authorization: "Bearer token"
				}
			};
			expect(input.type).toBe("HTTP");
			expect(input.method).toBe("GET");
		});

		it("should accept HTTPS input type", () => {
			const input: JobInput = {
				type: "HTTPS",
				url: "https://secure.example.com/video.mp4"
			};
			expect(input.type).toBe("HTTPS");
		});
	});

	describe("Type safety checks", () => {
		it("should enforce type constraints at compile time", () => {
			// These tests verify that TypeScript compilation succeeds
			// If there are type errors, the test file won't compile
			const storage: STORAGE_TYPE = "LOCAL";
			const database: DATABASE_TYPE = "SQLITE";
			const preset: FFMPEG_PRESET = "MEDIUM";

			expect(storage).toBe("LOCAL");
			expect(database).toBe("SQLITE");
			expect(preset).toBe("MEDIUM");
		});
	});
});
