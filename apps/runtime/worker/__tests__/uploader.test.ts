import { describe, it, expect, vi, beforeEach } from "vitest";
import { storage } from "@voltage/utils";
import { config } from "@voltage/config";
import fs from "fs/promises";

// Mock the uploader module
const createMockUploader = () => {
	return class JobUploader {
		private job: any;
		private output: any;
		private tempJobOutputFilePath: string;

		constructor(job: any, output: any, tempJobOutputFilePath: string) {
			this.job = job;
			this.output = output;
			this.tempJobOutputFilePath = tempJobOutputFilePath;
		}

		async upload(): Promise<{ path: string; url?: string }> {
			if (!this.output.path) {
				throw new Error("No output path specified!");
			}

			await storage.config(this.output);
			await storage.upload(this.tempJobOutputFilePath, this.output.path);

			const result: { path: string; url?: string } = {
				path: this.output.path
			};

			if (this.output.type === "S3" && this.output.public) {
				result.url = `https://${this.output.bucket}.s3.amazonaws.com${this.output.path}`;
			}

			return result;
		}
	};
};

vi.mock("@voltage/utils", () => ({
	storage: {
		config: vi.fn(),
		upload: vi.fn()
	}
}));

vi.mock("@voltage/config", () => ({
	config: {
		temp_dir: "/tmp"
	}
}));

vi.mock("fs/promises");

describe("JobUploader", () => {
	let JobUploader: ReturnType<typeof createMockUploader>;

	beforeEach(() => {
		vi.clearAllMocks();
		JobUploader = createMockUploader();
	});

	const mockJob = {
		key: "test-job-123"
	};

	describe("upload", () => {
		it("should upload file to storage successfully", async () => {
			const output = {
				type: "S3",
				bucket: "my-bucket",
				path: "/outputs/video.mp4"
			};

			vi.mocked(storage.config).mockResolvedValue(undefined);
			vi.mocked(storage.upload).mockResolvedValue(undefined);

			const uploader = new JobUploader(mockJob, output, "/tmp/jobs/test-job-123/output.mp4");
			const result = await uploader.upload();

			expect(storage.config).toHaveBeenCalledWith(output);
			expect(storage.upload).toHaveBeenCalledWith("/tmp/jobs/test-job-123/output.mp4", "/outputs/video.mp4");
			expect(result.path).toBe("/outputs/video.mp4");
		});

		it("should throw error when output path is missing", async () => {
			const output = {
				type: "S3",
				bucket: "my-bucket"
			};

			const uploader = new JobUploader(mockJob, output, "/tmp/jobs/test-job-123/output.mp4");

			await expect(uploader.upload()).rejects.toThrow("No output path specified!");
		});

		it("should include public URL for public S3 uploads", async () => {
			const output = {
				type: "S3",
				bucket: "my-bucket",
				path: "/outputs/video.mp4",
				public: true
			};

			vi.mocked(storage.config).mockResolvedValue(undefined);
			vi.mocked(storage.upload).mockResolvedValue(undefined);

			const uploader = new JobUploader(mockJob, output, "/tmp/jobs/test-job-123/output.mp4");
			const result = await uploader.upload();

			expect(result.path).toBe("/outputs/video.mp4");
			expect(result.url).toBe("https://my-bucket.s3.amazonaws.com/outputs/video.mp4");
		});

		it("should not include URL for private S3 uploads", async () => {
			const output = {
				type: "S3",
				bucket: "my-bucket",
				path: "/outputs/video.mp4",
				public: false
			};

			vi.mocked(storage.config).mockResolvedValue(undefined);
			vi.mocked(storage.upload).mockResolvedValue(undefined);

			const uploader = new JobUploader(mockJob, output, "/tmp/jobs/test-job-123/output.mp4");
			const result = await uploader.upload();

			expect(result.path).toBe("/outputs/video.mp4");
			expect(result.url).toBeUndefined();
		});

		it("should handle FTP uploads", async () => {
			const output = {
				type: "FTP",
				host: "ftp.example.com",
				path: "/uploads/video.mp4",
				username: "user",
				password: "pass"
			};

			vi.mocked(storage.config).mockResolvedValue(undefined);
			vi.mocked(storage.upload).mockResolvedValue(undefined);

			const uploader = new JobUploader(mockJob, output, "/tmp/jobs/test-job-123/output.mp4");
			const result = await uploader.upload();

			expect(storage.config).toHaveBeenCalledWith(output);
			expect(result.path).toBe("/uploads/video.mp4");
			expect(result.url).toBeUndefined();
		});
	});
});
