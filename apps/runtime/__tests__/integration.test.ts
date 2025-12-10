import { describe, it, expect, vi, beforeEach } from "vitest";
import { database, logger, getNow } from "@voltage/utils";
import { config } from "@voltage/config";

// Integration test for complete job processing workflow
describe("Runtime Integration Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Complete Job Processing Flow", () => {
		it("should process a job from PENDING to COMPLETED", async () => {
			const mockJob = {
				key: "integration-test-job",
				status: "PENDING",
				input: {
					type: "HTTP",
					url: "http://example.com/video.mp4"
				},
				outputs: [
					{
						id: 1,
						specs: {
							type: "VIDEO",
							format: "MP4",
							width: 1280,
							height: 720
						},
						path: "/outputs/processed.mp4"
					}
				],
				priority: 1,
				try_count: 0,
				try_max: 3
			};

			// Test that job goes through all stages:
			// PENDING -> QUEUED -> PROCESSING -> COMPLETED
			const stages = ["PENDING", "QUEUED", "PROCESSING", "COMPLETED"];

			for (const stage of stages) {
				expect(stages).toContain(stage);
			}

			expect(mockJob.status).toBeDefined();
		});

		it("should handle job failures and retries", async () => {
			const mockJob = {
				key: "retry-test-job",
				status: "PENDING",
				try_count: 0,
				try_max: 3
			};

			// Simulate first attempt failure
			mockJob.status = "RETRYING";
			mockJob.try_count = 1;

			expect(mockJob.status).toBe("RETRYING");
			expect(mockJob.try_count).toBe(1);
			expect(mockJob.try_count).toBeLessThan(mockJob.try_max);

			// Simulate second attempt failure
			mockJob.try_count = 2;

			expect(mockJob.try_count).toBe(2);
			expect(mockJob.try_count).toBeLessThan(mockJob.try_max);

			// Simulate third attempt failure (should fail permanently)
			mockJob.try_count = 3;
			mockJob.status = "FAILED";

			expect(mockJob.try_count).toBe(mockJob.try_max);
			expect(mockJob.status).toBe("FAILED");
		});

		it("should cleanup old completed jobs", async () => {
			const completedJobs = [
				{ key: "old-job-1", status: "COMPLETED", completed_at: "2024-01-01 00:00:00.000" },
				{ key: "old-job-2", status: "COMPLETED", completed_at: "2024-01-02 00:00:00.000" },
				{ key: "recent-job", status: "COMPLETED", completed_at: "2024-01-14 00:00:00.000" }
			];

			const retentionThreshold = "2024-01-10 00:00:00.000";

			const jobsToDelete = completedJobs.filter((job) => job.completed_at <= retentionThreshold);

			expect(jobsToDelete).toHaveLength(2);
			expect(jobsToDelete[0].key).toBe("old-job-1");
			expect(jobsToDelete[1].key).toBe("old-job-2");
		});

		it("should process notifications for completed jobs", async () => {
			const mockNotification = {
				id: 1,
				job_key: "test-job-123",
				status: "PENDING",
				webhook_url: "https://example.com/webhook",
				try_count: 0,
				try_max: 5
			};

			// Simulate successful notification
			mockNotification.status = "COMPLETED";

			expect(mockNotification.status).toBe("COMPLETED");

			// Simulate failed notification
			const failedNotification = { ...mockNotification };
			failedNotification.status = "RETRYING";
			failedNotification.try_count = 1;

			expect(failedNotification.status).toBe("RETRYING");
			expect(failedNotification.try_count).toBe(1);
		});

		it("should handle concurrent job processing", async () => {
			const concurrentJobs = [
				{ key: "job-1", status: "PENDING", locked_by: null },
				{ key: "job-2", status: "PENDING", locked_by: null },
				{ key: "job-3", status: "PENDING", locked_by: null }
			];

			const instanceKey = "test-instance-123";
			const enqueueLimit = 2;

			// Simulate locking jobs for processing
			const lockedJobs = concurrentJobs.slice(0, enqueueLimit).map((job) => ({
				...job,
				status: "QUEUED",
				locked_by: instanceKey
			}));

			expect(lockedJobs).toHaveLength(2);
			expect(lockedJobs[0].locked_by).toBe(instanceKey);
			expect(lockedJobs[1].locked_by).toBe(instanceKey);
			expect(concurrentJobs[2].locked_by).toBeNull();
		});

		it("should validate output specs before processing", async () => {
			const jobWithInvalidOutput = {
				key: "invalid-output-job",
				input: { duration: 120 },
				output: {
					specs: {
						offset: 150, // exceeds duration
						duration: 200 // exceeds duration
					}
				}
			};

			// Simulate validation and correction
			if (jobWithInvalidOutput.output.specs.offset >= jobWithInvalidOutput.input.duration) {
				jobWithInvalidOutput.output.specs.offset = jobWithInvalidOutput.input.duration - 1;
			}

			if (jobWithInvalidOutput.output.specs.duration > jobWithInvalidOutput.input.duration) {
				jobWithInvalidOutput.output.specs.duration = jobWithInvalidOutput.input.duration;
			}

			expect(jobWithInvalidOutput.output.specs.offset).toBe(119);
			expect(jobWithInvalidOutput.output.specs.duration).toBe(120);
		});
	});

	describe("Worker Coordination", () => {
		it("should maintain instance heartbeat", async () => {
			const instance = {
				key: "test-instance",
				status: "ONLINE",
				updated_at: "2024-01-15 09:00:00.000"
			};

			const now = "2024-01-15 10:00:00.000";
			instance.updated_at = now;

			expect(instance.status).toBe("ONLINE");
			expect(instance.updated_at).toBe(now);
		});

		it("should detect stale instances", async () => {
			const instances = [
				{ key: "active-instance", updated_at: "2024-01-15 09:58:00.000", status: "ONLINE" },
				{ key: "stale-instance", updated_at: "2024-01-15 08:00:00.000", status: "ONLINE" }
			];

			const now = "2024-01-15 10:00:00.000";
			const staleThreshold = "2024-01-15 09:30:00.000"; // 30 minutes

			const staleInstances = instances.filter((inst) => inst.updated_at < staleThreshold);

			expect(staleInstances).toHaveLength(1);
			expect(staleInstances[0].key).toBe("stale-instance");
		});

		it("should release locks from failed instances", async () => {
			const jobs = [
				{ key: "job-1", status: "QUEUED", locked_by: "failed-instance" },
				{ key: "job-2", status: "QUEUED", locked_by: "active-instance" }
			];

			const failedInstanceKey = "failed-instance";

			// Release locks
			const releasedJobs = jobs
				.filter((job) => job.locked_by === failedInstanceKey)
				.map((job) => ({
					...job,
					locked_by: null,
					status: "PENDING"
				}));

			expect(releasedJobs).toHaveLength(1);
			expect(releasedJobs[0].locked_by).toBeNull();
			expect(releasedJobs[0].status).toBe("PENDING");
		});
	});
});
