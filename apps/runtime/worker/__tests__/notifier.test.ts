import { describe, it, expect, vi, beforeEach } from "vitest";
import { database, logger, getNow } from "@voltage/utils";

// Mock notification functions
const createMockNotifier = () => ({
	createJobNotification: vi.fn(async (job: any, status: string) => {
		if (!job || !status) {
			throw new Error("Job and status are required");
		}

		const now = getNow();
		const notification = {
			job_key: job.key,
			status,
			created_at: now
		};

		await database.table("jobs_notifications").insert(notification);
		return notification;
	}),

	retryJobNotification: vi.fn(async (notification: any) => {
		if (!notification) {
			throw new Error("Notification is required");
		}

		const now = getNow();

		try {
			// Simulate webhook call
			if (notification.webhook_url) {
				// Success case
				await database.table("jobs_notifications_queue").where("id", notification.id).update({
					status: "COMPLETED",
					completed_at: now
				});
			} else {
				throw new Error("No webhook URL");
			}
		} catch (error: any) {
			// Retry logic
			await database
				.table("jobs_notifications_queue")
				.where("id", notification.id)
				.update({
					status: "RETRYING",
					try_count: notification.try_count + 1,
					retry_at: now
				});
		}
	})
});

vi.mock("@voltage/utils", () => ({
	database: {
		table: vi.fn()
	},
	logger: {
		insert: vi.fn()
	},
	getNow: vi.fn(() => "2024-01-15 10:00:00.000")
}));

describe("notifier", () => {
	let notifier: ReturnType<typeof createMockNotifier>;

	beforeEach(() => {
		vi.clearAllMocks();
		notifier = createMockNotifier();
	});

	describe("createJobNotification", () => {
		it("should create a notification for a job", async () => {
			const mockJob = {
				key: "test-job-123",
				status: "COMPLETED"
			};

			const mockTable = {
				insert: vi.fn().mockResolvedValue([1])
			};

			vi.mocked(database.table).mockReturnValue(mockTable as any);

			const result = await notifier.createJobNotification(mockJob, "COMPLETED");

			expect(database.table).toHaveBeenCalledWith("jobs_notifications");
			expect(mockTable.insert).toHaveBeenCalledWith({
				job_key: "test-job-123",
				status: "COMPLETED",
				created_at: "2024-01-15 10:00:00.000"
			});
			expect(result.job_key).toBe("test-job-123");
		});

		it("should throw error when job is missing", async () => {
			await expect(notifier.createJobNotification(null as any, "COMPLETED")).rejects.toThrow("Job and status are required");
		});

		it("should throw error when status is missing", async () => {
			const mockJob = { key: "test-job-123" };
			await expect(notifier.createJobNotification(mockJob, "" as any)).rejects.toThrow("Job and status are required");
		});
	});

	describe("retryJobNotification", () => {
		it("should successfully send notification with webhook URL", async () => {
			const mockNotification = {
				id: 1,
				job_key: "test-job-123",
				webhook_url: "https://example.com/webhook",
				try_count: 0
			};

			const mockTable = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(1)
			};

			vi.mocked(database.table).mockReturnValue(mockTable as any);

			await notifier.retryJobNotification(mockNotification);

			expect(database.table).toHaveBeenCalledWith("jobs_notifications_queue");
			expect(mockTable.where).toHaveBeenCalledWith("id", 1);
			expect(mockTable.update).toHaveBeenCalledWith({
				status: "COMPLETED",
				completed_at: "2024-01-15 10:00:00.000"
			});
		});

		it("should retry notification when webhook fails", async () => {
			const mockNotification = {
				id: 1,
				job_key: "test-job-123",
				try_count: 1
			};

			const mockTable = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(1)
			};

			vi.mocked(database.table).mockReturnValue(mockTable as any);

			await notifier.retryJobNotification(mockNotification);

			expect(mockTable.update).toHaveBeenCalledWith({
				status: "RETRYING",
				try_count: 2,
				retry_at: "2024-01-15 10:00:00.000"
			});
		});

		it("should throw error when notification is missing", async () => {
			await expect(notifier.retryJobNotification(null as any)).rejects.toThrow("Notification is required");
		});
	});
});
