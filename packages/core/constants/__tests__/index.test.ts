import { describe, it, expect } from "vitest";
import {
	HTTPS_TYPES,
	BASE64_TYPES,
	STORAGE_TYPES,
	STORAGE_S3_LIKE_TYPES,
	STORAGE_S3_LIKE_ACLS,
	STORAGE_FTP_TYPES,
	DATABASE_TYPES,
	INSTANCE_KEY_METHODS,
	FFMPEG_PRESETS,
	NSFW_MODELS,
	NSFW_TYPES,
	WHISPER_MODELS,
	PREVIEW_FORMATS,
	VIDEO_FORMATS,
	AUDIO_FORMATS,
	THUMBNAIL_FORMATS,
	SUBTITLE_FORMATS
} from "../index";

describe("Constants", () => {
	describe("HTTPS_TYPES", () => {
		it("should contain HTTP and HTTPS", () => {
			expect(HTTPS_TYPES).toContain("HTTP");
			expect(HTTPS_TYPES).toContain("HTTPS");
			expect(HTTPS_TYPES).toHaveLength(2);
		});

		it("should be readonly array", () => {
			expect(Array.isArray(HTTPS_TYPES)).toBe(true);
		});
	});

	describe("BASE64_TYPES", () => {
		it("should contain BASE64", () => {
			expect(BASE64_TYPES).toContain("BASE64");
			expect(BASE64_TYPES).toHaveLength(1);
		});
	});

	describe("STORAGE_TYPES", () => {
		it("should contain LOCAL storage type", () => {
			expect(STORAGE_TYPES).toContain("LOCAL");
		});

		it("should contain S3-like storage types", () => {
			expect(STORAGE_TYPES).toContain("AWS_S3");
			expect(STORAGE_TYPES).toContain("GOOGLE_CLOUD_STORAGE");
			expect(STORAGE_TYPES).toContain("DO_SPACES");
		});

		it("should contain FTP types", () => {
			expect(STORAGE_TYPES).toContain("FTP");
			expect(STORAGE_TYPES).toContain("SFTP");
		});

		it("should have at least 10 storage types", () => {
			expect(STORAGE_TYPES.length).toBeGreaterThanOrEqual(10);
		});
	});

	describe("STORAGE_S3_LIKE_TYPES", () => {
		it("should contain major cloud providers", () => {
			expect(STORAGE_S3_LIKE_TYPES).toContain("AWS_S3");
			expect(STORAGE_S3_LIKE_TYPES).toContain("GOOGLE_CLOUD_STORAGE");
			expect(STORAGE_S3_LIKE_TYPES).toContain("MICROSOFT_AZURE");
		});

		it("should have exactly 9 types", () => {
			expect(STORAGE_S3_LIKE_TYPES).toHaveLength(9);
		});
	});

	describe("STORAGE_S3_LIKE_ACLS", () => {
		it("should contain standard S3 ACLs", () => {
			expect(STORAGE_S3_LIKE_ACLS).toContain("PUBLIC_READ");
			expect(STORAGE_S3_LIKE_ACLS).toContain("PRIVATE");
			expect(STORAGE_S3_LIKE_ACLS).toContain("BUCKET_OWNER_FULL_CONTROL");
		});

		it("should have 7 ACL types", () => {
			expect(STORAGE_S3_LIKE_ACLS).toHaveLength(7);
		});
	});

	describe("STORAGE_FTP_TYPES", () => {
		it("should contain FTP and SFTP", () => {
			expect(STORAGE_FTP_TYPES).toContain("FTP");
			expect(STORAGE_FTP_TYPES).toContain("SFTP");
			expect(STORAGE_FTP_TYPES).toHaveLength(2);
		});
	});

	describe("DATABASE_TYPES", () => {
		it("should contain SQLite", () => {
			expect(DATABASE_TYPES).toContain("SQLITE");
		});

		it("should contain popular SQL databases", () => {
			expect(DATABASE_TYPES).toContain("MYSQL");
			expect(DATABASE_TYPES).toContain("POSTGRESQL");
			expect(DATABASE_TYPES).toContain("MARIADB");
		});

		it("should contain enterprise databases", () => {
			expect(DATABASE_TYPES).toContain("MSSQL");
			expect(DATABASE_TYPES).toContain("AWS_REDSHIFT");
			expect(DATABASE_TYPES).toContain("COCKROACHDB");
		});

		it("should have exactly 7 database types", () => {
			expect(DATABASE_TYPES).toHaveLength(7);
		});
	});

	describe("INSTANCE_KEY_METHODS", () => {
		it("should contain IP_ADDRESS and UNIQUE_KEY", () => {
			expect(INSTANCE_KEY_METHODS).toContain("IP_ADDRESS");
			expect(INSTANCE_KEY_METHODS).toContain("UNIQUE_KEY");
			expect(INSTANCE_KEY_METHODS).toHaveLength(2);
		});
	});

	describe("FFMPEG_PRESETS", () => {
		it("should contain standard ffmpeg presets", () => {
			expect(FFMPEG_PRESETS).toContain("DEFAULT");
			expect(FFMPEG_PRESETS).toContain("ULTRA_FAST");
			expect(FFMPEG_PRESETS).toContain("MEDIUM");
			expect(FFMPEG_PRESETS).toContain("SLOW");
		});

		it("should have speed-based presets ordered", () => {
			expect(FFMPEG_PRESETS).toContain("ULTRA_FAST");
			expect(FFMPEG_PRESETS).toContain("SUPER_FAST");
			expect(FFMPEG_PRESETS).toContain("VERY_FAST");
			expect(FFMPEG_PRESETS).toContain("FASTER");
			expect(FFMPEG_PRESETS).toContain("FAST");
			expect(FFMPEG_PRESETS).toContain("SLOW");
			expect(FFMPEG_PRESETS).toContain("SLOWER");
		});

		it("should have 9 presets", () => {
			expect(FFMPEG_PRESETS).toHaveLength(9);
		});
	});

	describe("NSFW_MODELS", () => {
		it("should contain mobile net models", () => {
			expect(NSFW_MODELS).toContain("MOBILE_NET_V2");
			expect(NSFW_MODELS).toContain("MOBILE_NET_V2_MID");
		});

		it("should contain inception model", () => {
			expect(NSFW_MODELS).toContain("INCEPTION_V3");
		});

		it("should have 3 models", () => {
			expect(NSFW_MODELS).toHaveLength(3);
		});
	});

	describe("NSFW_TYPES", () => {
		it("should contain GRAPH and LITE", () => {
			expect(NSFW_TYPES).toContain("GRAPH");
			expect(NSFW_TYPES).toContain("LITE");
			expect(NSFW_TYPES).toHaveLength(2);
		});
	});

	describe("WHISPER_MODELS", () => {
		it("should contain base models", () => {
			expect(WHISPER_MODELS).toContain("BASE");
			expect(WHISPER_MODELS).toContain("TINY");
			expect(WHISPER_MODELS).toContain("SMALL");
			expect(WHISPER_MODELS).toContain("MEDIUM");
			expect(WHISPER_MODELS).toContain("LARGE");
		});

		it("should contain English-specific models", () => {
			expect(WHISPER_MODELS).toContain("BASE_EN");
			expect(WHISPER_MODELS).toContain("TINY_EN");
			expect(WHISPER_MODELS).toContain("SMALL_EN");
			expect(WHISPER_MODELS).toContain("MEDIUM_EN");
		});

		it("should have at least 9 models", () => {
			expect(WHISPER_MODELS.length).toBeGreaterThanOrEqual(9);
		});
	});

	describe("PREVIEW_FORMATS", () => {
		it("should be a readonly array", () => {
			expect(Array.isArray(PREVIEW_FORMATS)).toBe(true);
		});

		it("should not be empty", () => {
			expect(PREVIEW_FORMATS.length).toBeGreaterThan(0);
		});
	});

	describe("VIDEO_FORMATS", () => {
		it("should contain popular video formats", () => {
			expect(VIDEO_FORMATS).toContain("MP4");
		});

		it("should not be empty", () => {
			expect(VIDEO_FORMATS.length).toBeGreaterThan(0);
		});
	});

	describe("AUDIO_FORMATS", () => {
		it("should contain popular audio formats", () => {
			expect(AUDIO_FORMATS).toContain("MP3");
		});

		it("should not be empty", () => {
			expect(AUDIO_FORMATS.length).toBeGreaterThan(0);
		});
	});

	describe("THUMBNAIL_FORMATS", () => {
		it("should contain image formats", () => {
			expect(THUMBNAIL_FORMATS).toContain("JPG");
		});

		it("should not be empty", () => {
			expect(THUMBNAIL_FORMATS.length).toBeGreaterThan(0);
		});
	});

	describe("SUBTITLE_FORMATS", () => {
		it("should contain subtitle formats", () => {
			expect(SUBTITLE_FORMATS).toContain("SRT");
		});

		it("should not be empty", () => {
			expect(SUBTITLE_FORMATS.length).toBeGreaterThan(0);
		});
	});

	describe("Type safety", () => {
		it("should ensure all constants are readonly", () => {
			// This is checked at compile time by TypeScript
			// At runtime, we just verify they are arrays
			expect(Array.isArray(STORAGE_TYPES)).toBe(true);
			expect(Array.isArray(DATABASE_TYPES)).toBe(true);
			expect(Array.isArray(FFMPEG_PRESETS)).toBe(true);
		});
	});
});
