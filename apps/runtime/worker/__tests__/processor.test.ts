import { describe, it, expect, vi, beforeEach } from "vitest";
import { JobOutputProcessor } from "../processor";
import { config } from "@voltage/config";

vi.mock("@voltage/config", () => ({
	config: {
		temp_dir: "/tmp",
		utils: {
			ffmpeg: {
				path: "/usr/bin/ffmpeg"
			}
		}
	}
}));

vi.mock("child_process");
vi.mock("fs/promises");
vi.mock("jimp");
vi.mock("sharp");

describe("JobOutputProcessor", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const mockJob = {
		key: "test-job-123",
		input: {
			duration: 120,
			width: 1920,
			height: 1080
		}
	};

	describe("constructor", () => {
		it("should set default output type and format", () => {
			const output: any = { specs: {} };
			const processor = new JobOutputProcessor(mockJob, output);

			expect(output.specs.type).toBe("VIDEO");
			expect(output.specs.format).toBe("MP4");
		});

		it("should normalize type and format to uppercase", () => {
			const output = { specs: { type: "image", format: "png" } };
			const processor = new JobOutputProcessor(mockJob, output);

			expect(output.specs.type).toBe("IMAGE");
			expect(output.specs.format).toBe("PNG");
		});

		it("should validate and adjust offset to be within input duration", () => {
			const output = { specs: { offset: 150 } }; // Greater than job duration (120)
			const processor = new JobOutputProcessor(mockJob, output);

			expect(output.specs.offset).toBe(119); // duration - 1
		});

		it("should remove offset if it's less than or equal to 0", () => {
			const output = { specs: { offset: -5 } };
			const processor = new JobOutputProcessor(mockJob, output);

			expect(output.specs.offset).toBeUndefined();
		});

		it("should calculate duration when offset is provided but duration is not", () => {
			const output: any = { specs: { offset: 30 } };
			const processor = new JobOutputProcessor(mockJob, output);

			expect(output.specs.duration).toBe(90); // 120 - 30
		});

		it("should adjust duration if it exceeds available time after offset", () => {
			const output = { specs: { offset: 30, duration: 100 } };
			const processor = new JobOutputProcessor(mockJob, output);

			expect(output.specs.duration).toBe(90); // 120 - 30
		});

		it("should remove duration if it equals input duration", () => {
			const output = { specs: { duration: 120 } };
			const processor = new JobOutputProcessor(mockJob, output);

			expect(output.specs.duration).toBeUndefined();
		});

		it("should remove duration if it's less than or equal to 0", () => {
			const output = { specs: { offset: 119, duration: -5 } };
			const processor = new JobOutputProcessor(mockJob, output);

			expect(output.specs.duration).toBeUndefined();
		});
	});

	describe("output validation edge cases", () => {
		it("should handle job without duration", () => {
			const jobNoDuration = { key: "test-job", input: {} };
			const output = { specs: { offset: 30, duration: 60 } };

			const processor = new JobOutputProcessor(jobNoDuration, output);

			// Should keep original values when no input duration
			expect(output.specs.offset).toBe(30);
			expect(output.specs.duration).toBe(60);
		});

		it("should handle output with only duration specified", () => {
			const output: any = { specs: { duration: 60 } };
			const processor = new JobOutputProcessor(mockJob, output);

			expect(output.specs.offset).toBeUndefined();
			expect(output.specs.duration).toBe(60);
		});

		it("should handle output with offset at the last second", () => {
			const output: any = { specs: { offset: 119 } };
			const processor = new JobOutputProcessor(mockJob, output);

			expect(output.specs.offset).toBe(119);
			expect(output.specs.duration).toBe(1); // Only 1 second left
		});

		it("should remove both offset and duration when null", () => {
			const output = { specs: { offset: null, duration: null } };
			const processor = new JobOutputProcessor(mockJob, output);

			expect(output.specs.offset).toBeUndefined();
			expect(output.specs.duration).toBeUndefined();
		});
	});
});
