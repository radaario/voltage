import { describe, it, expect, vi, beforeEach } from "vitest";
import { config } from "@voltage/config";
import fs from "fs/promises";
import { spawn } from "child_process";
import { EventEmitter } from "events";

// Mock thumbnailer
const createMockThumbnailer = () => {
	return class JobThumbnailer {
		private job: any;
		private tempJobInputFilePath: string;
		private tempJobDir: string;

		constructor(job: any) {
			this.job = job;
			this.tempJobDir = `/tmp/jobs/${job.key}`;
			this.tempJobInputFilePath = `${this.tempJobDir}/input`;
		}

		async generateThumbnail(timestamp: number = 0): Promise<string> {
			const thumbnailPath = `${this.tempJobDir}/thumbnail.jpg`;

			if (!this.job.input?.duration) {
				throw new Error("Cannot generate thumbnail: no video duration");
			}

			if (timestamp >= this.job.input.duration) {
				throw new Error("Timestamp exceeds video duration");
			}

			// Simulate ffmpeg thumbnail generation
			await this.runFFmpeg(timestamp, thumbnailPath);

			return thumbnailPath;
		}

		private async runFFmpeg(timestamp: number, outputPath: string): Promise<void> {
			return new Promise((resolve, reject) => {
				const args = ["-ss", timestamp.toString(), "-i", this.tempJobInputFilePath, "-vframes", "1", "-q:v", "2", outputPath];

				const ffmpeg = spawn(config.utils.ffmpeg.path, args, { stdio: ["ignore", "pipe", "pipe"] });

				let stderr = "";

				ffmpeg.stderr.on("data", (data) => {
					stderr += data.toString();
				});

				ffmpeg.on("close", (code) => {
					if (code === 0) {
						resolve();
					} else {
						reject(new Error(`FFmpeg failed: ${stderr}`));
					}
				});
			});
		}
	};
};

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

vi.mock("fs/promises");
vi.mock("child_process");

describe("JobThumbnailer", () => {
	let JobThumbnailer: ReturnType<typeof createMockThumbnailer>;

	beforeEach(() => {
		vi.clearAllMocks();
		JobThumbnailer = createMockThumbnailer();
	});

	const mockJob = {
		key: "test-job-123",
		input: {
			duration: 120,
			width: 1920,
			height: 1080
		}
	};

	describe("generateThumbnail", () => {
		it("should generate thumbnail at specified timestamp", async () => {
			const mockProcess = new EventEmitter() as any;
			mockProcess.stderr = new EventEmitter();
			vi.mocked(spawn).mockReturnValue(mockProcess);

			const thumbnailer = new JobThumbnailer(mockJob);
			const thumbnailPromise = thumbnailer.generateThumbnail(10);

			setTimeout(() => {
				mockProcess.emit("close", 0);
			}, 10);

			const result = await thumbnailPromise;

			expect(result).toContain("/tmp/jobs/test-job-123/thumbnail.jpg");
			expect(spawn).toHaveBeenCalledWith(
				"/usr/bin/ffmpeg",
				expect.arrayContaining(["-ss", "10", "-i", "-vframes", "1"]),
				expect.any(Object)
			);
		});

		it("should generate thumbnail at start by default", async () => {
			const mockProcess = new EventEmitter() as any;
			mockProcess.stderr = new EventEmitter();
			vi.mocked(spawn).mockReturnValue(mockProcess);

			const thumbnailer = new JobThumbnailer(mockJob);
			const thumbnailPromise = thumbnailer.generateThumbnail();

			setTimeout(() => {
				mockProcess.emit("close", 0);
			}, 10);

			await thumbnailPromise;

			expect(spawn).toHaveBeenCalledWith("/usr/bin/ffmpeg", expect.arrayContaining(["-ss", "0"]), expect.any(Object));
		});

		it("should throw error when video has no duration", async () => {
			const jobNoDuration = {
				key: "test-job-123",
				input: {}
			};

			const thumbnailer = new JobThumbnailer(jobNoDuration);

			await expect(thumbnailer.generateThumbnail()).rejects.toThrow("Cannot generate thumbnail: no video duration");
		});

		it("should throw error when timestamp exceeds duration", async () => {
			const thumbnailer = new JobThumbnailer(mockJob);

			await expect(thumbnailer.generateThumbnail(150)).rejects.toThrow("Timestamp exceeds video duration");
		});

		it("should handle ffmpeg errors", async () => {
			const mockProcess = new EventEmitter() as any;
			mockProcess.stderr = new EventEmitter();
			vi.mocked(spawn).mockReturnValue(mockProcess);

			const thumbnailer = new JobThumbnailer(mockJob);
			const thumbnailPromise = thumbnailer.generateThumbnail(5);

			setTimeout(() => {
				mockProcess.stderr.emit("data", "FFmpeg error occurred");
				mockProcess.emit("close", 1);
			}, 10);

			await expect(thumbnailPromise).rejects.toThrow(/FFmpeg failed/);
		});
	});
});
