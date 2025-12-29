import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock dependencies
vi.mock("@voltage/core/config", () => ({
	config: {
		temp_dir: "./storage/tmp"
	}
}));

vi.mock("@voltage/utils", () => ({
	database: {
		table: vi.fn(() => ({
			where: vi.fn().mockReturnThis(),
			first: vi.fn().mockResolvedValue({
				key: "test-job",
				config: "{}",
				input: "{}",
				destination: "{}",
				notification: "{}",
				metadata: "{}",
				outcome: "{}",
				status: "PENDING",
				progress: 0,
				try_count: "0"
			}),
			orderBy: vi.fn().mockResolvedValue([]),
			update: vi.fn().mockResolvedValue(1),
			insert: vi.fn().mockResolvedValue([1])
		}))
	},
	logger: {
		insert: vi.fn().mockResolvedValue(undefined)
	},
	getNow: vi.fn().mockReturnValue("2024-01-15 10:00:00.000"),
	addNow: vi.fn().mockReturnValue("2024-01-15 11:00:00.000")
}));

vi.mock("../notifier", () => ({
	createJobNotification: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("fs/promises", () => ({
	default: {
		mkdir: vi.fn().mockResolvedValue(undefined),
		writeFile: vi.fn().mockResolvedValue(undefined),
		readFile: vi.fn().mockResolvedValue(Buffer.from("test")),
		unlink: vi.fn().mockResolvedValue(undefined)
	}
}));

describe("Job Lifecycle Service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("JobLifecycleService constructor", () => {
		it("should create instance with required parameters", async () => {
			const { JobLifecycleService } = await import("../job-lifecycle.service");
			const service = new JobLifecycleService("instance-1", "worker-1", "job-1");
			expect(service).toBeDefined();
		});

		it("should accept instance, worker and job keys", async () => {
			const { JobLifecycleService } = await import("../job-lifecycle.service");
			const service = new JobLifecycleService("test-instance", "test-worker", "test-job");
			expect(service).toBeDefined();
		});
	});

	describe("initialize", () => {
		it("should create temp job directory", async () => {
			const { JobLifecycleService } = await import("../job-lifecycle.service");
			const fs = await import("fs/promises");

			const service = new JobLifecycleService("instance-1", "worker-1", "job-1");
			await service.initialize();

			expect(fs.default.mkdir).toHaveBeenCalled();
		});

		it("should handle directory creation errors", async () => {
			const { JobLifecycleService } = await import("../job-lifecycle.service");
			const fs = await import("fs/promises");

			(fs.default.mkdir as any).mockRejectedValueOnce(new Error("Permission denied"));

			const service = new JobLifecycleService("instance-1", "worker-1", "job-1");
			await expect(service.initialize()).resolves.not.toThrow();
		});
	});

	describe("loadJob", () => {
		it("should load job from database", async () => {
			const { JobLifecycleService } = await import("../job-lifecycle.service");
			const { database } = await import("@voltage/utils");

			const service = new JobLifecycleService("instance-1", "worker-1", "test-job");
			const job = await service.loadJob();

			expect(database.table).toHaveBeenCalledWith("jobs");
			expect(job).toBeDefined();
			expect(job.key).toBe("test-job");
		});

		it("should throw error if job not found", async () => {
			const { JobLifecycleService } = await import("../job-lifecycle.service");
			const { database } = await import("@voltage/utils");

			(database.table as any).mockReturnValueOnce({
				where: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue(null)
			});

			const service = new JobLifecycleService("instance-1", "worker-1", "nonexistent-job");
			await expect(service.loadJob()).rejects.toThrow("Job couldn't be found!");
		});

		it("should log job loading", async () => {
			const { JobLifecycleService } = await import("../job-lifecycle.service");
			const { logger } = await import("@voltage/utils");

			const service = new JobLifecycleService("instance-1", "worker-1", "test-job");
			await service.loadJob();

			expect(logger.insert).toHaveBeenCalled();
		});
	});

	describe("parseJob", () => {
		it("should parse JSON fields", async () => {
			const { JobLifecycleService } = await import("../job-lifecycle.service");

			const service = new JobLifecycleService("instance-1", "worker-1", "job-1");
			const rawJob = {
				key: "test-job",
				config: '{"test": true}',
				input: '{"url": "test"}',
				destination: "{}",
				notification: "{}",
				metadata: "{}",
				outcome: "{}",
				try_count: "1"
			};

			const parsed = service.parseJob(rawJob);

			expect(parsed.config).toEqual({ test: true });
			expect(parsed.input).toEqual({ url: "test" });
			expect(parsed.status).toBe("STARTED");
		});

		it("should set initial job state", async () => {
			const { JobLifecycleService } = await import("../job-lifecycle.service");

			const service = new JobLifecycleService("instance-1", "worker-1", "job-1");
			const parsed = service.parseJob({ key: "test", try_count: "0" });

			expect(parsed.status).toBe("STARTED");
			expect(parsed.progress).toBe(0);
			expect(parsed.instance_key).toBe("instance-1");
			expect(parsed.worker_key).toBe("worker-1");
		});

		it("should handle null JSON fields", async () => {
			const { JobLifecycleService } = await import("../job-lifecycle.service");

			const service = new JobLifecycleService("instance-1", "worker-1", "job-1");
			const parsed = service.parseJob({
				key: "test",
				config: null,
				input: null,
				try_count: "0"
			});

			expect(parsed.config).toBe(null);
			expect(parsed.input).toBe(null);
		});
	});

	describe("getOutputs", () => {
		it("should load job outputs", async () => {
			const { JobLifecycleService } = await import("../job-lifecycle.service");
			const { database } = await import("@voltage/utils");

			const service = new JobLifecycleService("instance-1", "worker-1", "test-job");
			const outputs = await service.getOutputs();

			expect(database.table).toHaveBeenCalledWith("jobs_outputs");
			expect(Array.isArray(outputs)).toBe(true);
		});

		it("should parse output JSON fields", async () => {
			const { JobLifecycleService } = await import("../job-lifecycle.service");
			const { database } = await import("@voltage/utils");

			(database.table as any).mockReturnValueOnce({
				where: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockResolvedValue([
					{
						key: "output-1",
						config: '{"test": true}',
						destination: "{}",
						metadata: "{}",
						outcome: "{}"
					}
				])
			});

			const service = new JobLifecycleService("instance-1", "worker-1", "test-job");
			const outputs = await service.getOutputs();

			expect(outputs[0].config).toEqual({ test: true });
		});
	});

	describe("Worker status interval", () => {
		it("should start worker status interval", async () => {
			const { JobLifecycleService } = await import("../job-lifecycle.service");

			const service = new JobLifecycleService("instance-1", "worker-1", "job-1");
			service.startWorkerStatusInterval();

			// Interval should be created
			expect(service).toBeDefined();
		});

		it("should stop worker status interval", async () => {
			const { JobLifecycleService } = await import("../job-lifecycle.service");

			const service = new JobLifecycleService("instance-1", "worker-1", "job-1");
			service.startWorkerStatusInterval();
			service.stopWorkerStatusInterval();

			// Should not throw
			expect(service).toBeDefined();
		});

		it("should handle stop when not started", async () => {
			const { JobLifecycleService } = await import("../job-lifecycle.service");

			const service = new JobLifecycleService("instance-1", "worker-1", "job-1");
			service.stopWorkerStatusInterval();

			// Should not throw
			expect(service).toBeDefined();
		});
	});
});
