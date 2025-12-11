import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JobDownloader } from "../downloader";
import { storage } from "@voltage/utils";
import { config } from "@voltage/config";
import fs from "fs/promises";
import axios from "axios";

vi.mock("@voltage/utils", () => ({
	storage: {
		config: vi.fn(),
		download: vi.fn()
	}
}));

vi.mock("@voltage/config", () => ({
	config: {
		temp_dir: "/tmp"
	}
}));

vi.mock("fs/promises");
vi.mock("axios");

describe("JobDownloader", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const mockJob = {
		key: "test-job-123",
		input: {}
	};

	describe("download", () => {
		it("should throw error when no input is specified", async () => {
			const downloader = new JobDownloader({ ...mockJob, input: null });

			await expect(downloader.download()).rejects.toThrow("No input specified for job!");
		});

		it("should download BASE64 input", async () => {
			const job = {
				...mockJob,
				input: {
					type: "BASE64",
					content: Buffer.from("test content").toString("base64")
				}
			};

			const downloader = new JobDownloader(job);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			const result = await downloader.download();

			expect(result.temp_path).toContain("tmp");
			expect(result.temp_path).toContain("jobs");
			expect(result.temp_path).toContain("test-job-123");
			expect(fs.writeFile).toHaveBeenCalledWith(expect.any(String), expect.any(Buffer));
		});

		it("should download HTTP input", async () => {
			const job = {
				...mockJob,
				input: {
					type: "HTTP",
					url: "http://example.com/video.mp4"
				}
			};

			const mockData = Buffer.from("video data");
			vi.mocked(axios.get).mockResolvedValue({ data: mockData } as any);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			const downloader = new JobDownloader(job);
			const result = await downloader.download();

			expect(axios.get).toHaveBeenCalledWith("http://example.com/video.mp4", {
				responseType: "arraybuffer",
				auth: undefined
			});
			expect(result.temp_path).toContain("tmp");
			expect(result.temp_path).toContain("jobs");
			expect(result.temp_path).toContain("test-job-123");
		});

		it("should download HTTP input with authentication", async () => {
			const job = {
				...mockJob,
				input: {
					type: "HTTPS",
					url: "https://example.com/video.mp4",
					username: "user",
					password: "pass"
				}
			};

			const mockData = Buffer.from("video data");
			vi.mocked(axios.get).mockResolvedValue({ data: mockData } as any);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			const downloader = new JobDownloader(job);
			const result = await downloader.download();

			expect(axios.get).toHaveBeenCalledWith("https://example.com/video.mp4", {
				responseType: "arraybuffer",
				auth: {
					username: "user",
					password: "pass"
				}
			});
		});

		it("should download from storage", async () => {
			const job = {
				...mockJob,
				input: {
					type: "S3",
					path: "/videos/input.mp4",
					bucket: "my-bucket"
				}
			};

			vi.mocked(storage.config).mockResolvedValue(undefined);
			vi.mocked(storage.download).mockResolvedValue(undefined);

			const downloader = new JobDownloader(job);
			const result = await downloader.download();

			expect(storage.config).toHaveBeenCalledWith(job.input);
			expect(storage.download).toHaveBeenCalledWith("/videos/input.mp4", expect.any(String));
			expect(result.temp_path).toContain("tmp");
			expect(result.temp_path).toContain("jobs");
			expect(result.temp_path).toContain("test-job-123");
		});

		it("should throw error for unsupported input type", async () => {
			const job = {
				...mockJob,
				input: {
					type: "UNKNOWN"
				}
			};

			const downloader = new JobDownloader(job);

			await expect(downloader.download()).rejects.toThrow("No path specified for job input!");
		});

		it("should throw error when BASE64 content is missing", async () => {
			const job = {
				...mockJob,
				input: {
					type: "BASE64"
				}
			};

			const downloader = new JobDownloader(job);

			await expect(downloader.download()).rejects.toThrow("No base64 content found for job input!");
		});

		it("should throw error when storage path is missing", async () => {
			const job = {
				...mockJob,
				input: {
					type: "S3"
				}
			};

			const downloader = new JobDownloader(job);

			await expect(downloader.download()).rejects.toThrow("No path specified for job input!");
		});
	});
});
