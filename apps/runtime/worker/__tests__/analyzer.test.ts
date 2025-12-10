import { describe, it, expect, vi, beforeEach } from "vitest";
import { JobAnalyzer } from "../analyzer";
import { guessContentType } from "@voltage/utils";
import { config } from "@voltage/config";
import fs from "fs/promises";
import { spawn } from "child_process";
import { EventEmitter } from "events";

vi.mock("@voltage/utils", () => ({
	guessContentType: vi.fn()
}));

vi.mock("@voltage/config", () => ({
	config: {
		temp_dir: "/tmp",
		utils: {
			ffprobe: {
				path: "/usr/bin/ffprobe"
			}
		}
	}
}));

vi.mock("fs/promises");
vi.mock("child_process");

describe("JobAnalyzer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const mockJob = {
		key: "test-job-123",
		input: {
			url: "http://example.com/video.mp4"
		}
	};

	describe("analyze", () => {
		it("should analyze video file successfully", async () => {
			const mockStats = { size: 1024000 };
			vi.mocked(fs.stat).mockResolvedValue(mockStats as any);
			vi.mocked(guessContentType).mockReturnValue("video/mp4");

			const mockFfprobeOutput = {
				format: {
					duration: "120.5",
					bit_rate: "500000",
					format_name: "mp4"
				},
				streams: [
					{
						codec_type: "video",
						codec_name: "h264",
						width: 1920,
						height: 1080,
						r_frame_rate: "30/1"
					},
					{
						codec_type: "audio",
						codec_name: "aac",
						sample_rate: "48000"
					}
				]
			};

			const mockProcess = new EventEmitter() as any;
			mockProcess.stdout = new EventEmitter();
			mockProcess.stderr = new EventEmitter();
			vi.mocked(spawn).mockReturnValue(mockProcess);

			const analyzer = new JobAnalyzer(mockJob);
			const analyzePromise = analyzer.analyze();

			// Simulate ffprobe output
			setTimeout(() => {
				mockProcess.stdout.emit("data", JSON.stringify(mockFfprobeOutput));
				mockProcess.emit("close", 0);
			}, 10);

			const result = await analyzePromise;

			expect(fs.stat).toHaveBeenCalled();
			expect(guessContentType).toHaveBeenCalledWith("video.mp4");
			expect(spawn).toHaveBeenCalledWith(
				"/usr/bin/ffprobe",
				expect.arrayContaining(["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams"]),
				expect.any(Object)
			);
			expect(result).toHaveProperty("file_name", "video.mp4");
			expect(result).toHaveProperty("file_size", 1024000);
		});

		it("should handle ffprobe errors", async () => {
			const mockStats = { size: 1024000 };
			vi.mocked(fs.stat).mockResolvedValue(mockStats as any);
			vi.mocked(guessContentType).mockReturnValue("video/mp4");

			const mockProcess = new EventEmitter() as any;
			mockProcess.stdout = new EventEmitter();
			mockProcess.stderr = new EventEmitter();
			vi.mocked(spawn).mockReturnValue(mockProcess);

			const analyzer = new JobAnalyzer(mockJob);
			const analyzePromise = analyzer.analyze();

			// Simulate ffprobe error
			setTimeout(() => {
				mockProcess.stderr.emit("data", "FFprobe error");
				mockProcess.emit("close", 1);
			}, 10);

			await expect(analyzePromise).rejects.toThrow();
		});

		it("should extract file information from path when URL is not provided", async () => {
			const jobWithPath = {
				key: "test-job-123",
				input: {
					path: "/storage/videos/sample.mkv"
				}
			};

			const mockStats = { size: 2048000 };
			vi.mocked(fs.stat).mockResolvedValue(mockStats as any);
			vi.mocked(guessContentType).mockReturnValue("video/x-matroska");

			const mockFfprobeOutput = {
				format: { duration: "60", format_name: "matroska" },
				streams: []
			};

			const mockProcess = new EventEmitter() as any;
			mockProcess.stdout = new EventEmitter();
			mockProcess.stderr = new EventEmitter();
			vi.mocked(spawn).mockReturnValue(mockProcess);

			const analyzer = new JobAnalyzer(jobWithPath);
			const analyzePromise = analyzer.analyze();

			setTimeout(() => {
				mockProcess.stdout.emit("data", JSON.stringify(mockFfprobeOutput));
				mockProcess.emit("close", 0);
			}, 10);

			const result = await analyzePromise;

			expect(result).toHaveProperty("file_name", "sample.mkv");
			expect(result).toHaveProperty("file_extension", "mkv");
		});

		it("should handle invalid JSON from ffprobe", async () => {
			const mockStats = { size: 1024000 };
			vi.mocked(fs.stat).mockResolvedValue(mockStats as any);
			vi.mocked(guessContentType).mockReturnValue("video/mp4");

			const mockProcess = new EventEmitter() as any;
			mockProcess.stdout = new EventEmitter();
			mockProcess.stderr = new EventEmitter();
			vi.mocked(spawn).mockReturnValue(mockProcess);

			const analyzer = new JobAnalyzer(mockJob);
			const analyzePromise = analyzer.analyze();

			setTimeout(() => {
				mockProcess.stdout.emit("data", "invalid json");
				mockProcess.emit("close", 0);
			}, 10);

			await expect(analyzePromise).rejects.toThrow(/Failed to parse FFProbe output/);
		});
	});
});
