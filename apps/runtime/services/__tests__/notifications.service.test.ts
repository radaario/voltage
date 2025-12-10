import { describe, it, expect, vi, beforeEach } from "vitest";
import { processJobsNotifications } from "../notifications.service";
import { database, logger, getInstanceKey, getNow } from "@voltage/utils";
import { config } from "@voltage/config";

vi.mock("@voltage/utils", () => ({
	database: {
		table: vi.fn()
	},
	logger: {
		insert: vi.fn()
	},
	getInstanceKey: vi.fn(() => "test-instance-123"),
	getNow: vi.fn(() => "2024-01-15 10:00:00.000")
}));

vi.mock("@voltage/config", () => ({
	config: {
		jobs: {
			notifications: {
				process_limit: 10
			}
		}
	}
}));

vi.mock("@/worker/notifier.js", () => ({
	retryJobNotification: vi.fn().mockResolvedValue(undefined)
}));

describe("notifications.service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("processJobsNotifications", () => {
		it("should process pending notifications successfully", async () => {
			const mockNotifications = [
				{ id: 1, job_key: "job1", status: "PENDING" },
				{ id: 2, job_key: "job2", status: "PENDING" }
			];

			const mockTable = {
				where: vi.fn().mockReturnThis(),
				orWhere: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockReturnThis(),
				limit: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(2)
			};

			vi.mocked(database.table).mockReturnValue(mockTable as any);
			mockTable.where.mockResolvedValueOnce(undefined); // Lock update
			mockTable.where.mockResolvedValueOnce(mockNotifications); // Select locked
			mockTable.where.mockResolvedValueOnce(undefined); // Release update

			const { retryJobNotification } = await import("@/worker/notifier.js");

			await processJobsNotifications();

			expect(database.table).toHaveBeenCalledWith("jobs_notifications_queue");
			expect(mockTable.limit).toHaveBeenCalledWith(10);
			expect(retryJobNotification).toHaveBeenCalledTimes(2);
			expect(retryJobNotification).toHaveBeenCalledWith(mockNotifications[0]);
			expect(retryJobNotification).toHaveBeenCalledWith(mockNotifications[1]);
		});

		it("should handle errors and log them", async () => {
			const mockTable = {
				where: vi.fn().mockReturnThis(),
				orWhere: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockReturnThis(),
				limit: vi.fn().mockReturnThis(),
				update: vi.fn().mockRejectedValue(new Error("Database error"))
			};

			vi.mocked(database.table).mockReturnValue(mockTable as any);

			await processJobsNotifications();

			expect(logger.insert).toHaveBeenCalledWith(
				"INSTANCE",
				"ERROR",
				"Failed to process jobs notifications queue!",
				expect.objectContaining({ message: "Database error" })
			);
		});

		it("should release locks even when processing fails", async () => {
			const mockNotifications = [{ id: 1, job_key: "job1", status: "PENDING" }];
			const mockTable = {
				where: vi.fn().mockReturnThis(),
				orWhere: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockReturnThis(),
				limit: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(1)
			};

			vi.mocked(database.table).mockReturnValue(mockTable as any);
			mockTable.where.mockResolvedValueOnce(undefined); // Lock
			mockTable.where.mockResolvedValueOnce(mockNotifications); // Select

			const { retryJobNotification } = await import("@/worker/notifier.js");
			vi.mocked(retryJobNotification).mockRejectedValue(new Error("Notification error"));

			await processJobsNotifications();

			// Should still attempt to release locks
			expect(mockTable.update).toHaveBeenCalledWith({ locked_by: null });
		});
	});
});
