import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { database, logger, getInstanceKey, getNow } from "@voltage/utils";
import { config as appConfig } from "@voltage/core/config";

// Mock dependencies
vi.mock("@voltage/utils", () => ({
	database: {
		table: vi.fn()
	},
	logger: {
		console: vi.fn(),
		insert: vi.fn()
	},
	getInstanceKey: vi.fn(() => "test-instance-key"),
	getNow: vi.fn(() => "2025-01-01T00:00:00.000Z")
}));

vi.mock("@voltage/core/config", () => ({
	config: {
		jobs: {
			notifications: {
				process_limit: 10
			}
		}
	}
}));

vi.mock("@/worker/notifier.js", () => ({
	retryJobNotification: vi.fn().mockResolvedValue(true)
}));

describe("Notifications Service", () => {
	let processJobsNotifications: any;

	beforeEach(async () => {
		vi.clearAllMocks();
		const module = await import("../notifications.service.js");
		processJobsNotifications = module.processJobsNotifications;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("processJobsNotifications", () => {
		it("should lock and process pending notifications", async () => {
			const mockNotifications = [
				{ key: "notif1", job_key: "job1", status: "PENDING", priority: 1 },
				{ key: "notif2", job_key: "job2", status: "PENDING", priority: 2 }
			];

			const mockLockQuery: any = {
				where: vi.fn().mockReturnThis(),
				orWhere: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockReturnThis(),
				limit: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(2)
			};

			const mockSelectQuery: any = {
				where: vi.fn().mockResolvedValue(mockNotifications)
			};

			const mockReleaseQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(2)
			};

			const { retryJobNotification } = await import("@/worker/notifier.js");

			(database.table as any)
				.mockReturnValueOnce(mockLockQuery)
				.mockReturnValueOnce(mockSelectQuery)
				.mockReturnValueOnce(mockReleaseQuery);

			await processJobsNotifications();

			expect(mockLockQuery.update).toHaveBeenCalledWith({ locked_by: "test-instance-key" });
			expect(retryJobNotification).toHaveBeenCalledTimes(2);
			expect(retryJobNotification).toHaveBeenCalledWith(mockNotifications[0]);
			expect(retryJobNotification).toHaveBeenCalledWith(mockNotifications[1]);
			expect(mockReleaseQuery.update).toHaveBeenCalledWith({ locked_by: null });
		});

		it("should handle empty notifications queue", async () => {
			const mockLockQuery: any = {
				where: vi.fn().mockReturnThis(),
				orWhere: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockReturnThis(),
				limit: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(0)
			};

			const mockSelectQuery: any = {
				where: vi.fn().mockResolvedValue([])
			};

			const mockReleaseQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(0)
			};

			const { retryJobNotification } = await import("@/worker/notifier.js");

			(database.table as any)
				.mockReturnValueOnce(mockLockQuery)
				.mockReturnValueOnce(mockSelectQuery)
				.mockReturnValueOnce(mockReleaseQuery);

			await processJobsNotifications();

			expect(retryJobNotification).not.toHaveBeenCalled();
			expect(mockReleaseQuery.update).toHaveBeenCalledWith({ locked_by: null });
		});

		it("should process retrying notifications with retry_at check", async () => {
			const mockNotifications = [
				{ key: "notif1", job_key: "job1", status: "RETRYING", retry_at: "2024-12-31T23:59:00.000Z", priority: 1 }
			];

			const mockLockQuery: any = {
				where: vi.fn().mockReturnThis(),
				orWhere: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockReturnThis(),
				limit: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(1)
			};

			const mockSelectQuery: any = {
				where: vi.fn().mockResolvedValue(mockNotifications)
			};

			const mockReleaseQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(1)
			};

			const { retryJobNotification } = await import("@/worker/notifier.js");

			(database.table as any)
				.mockReturnValueOnce(mockLockQuery)
				.mockReturnValueOnce(mockSelectQuery)
				.mockReturnValueOnce(mockReleaseQuery);

			await processJobsNotifications();

			expect(mockLockQuery.where).toHaveBeenCalled();
			expect(retryJobNotification).toHaveBeenCalledWith(mockNotifications[0]);
		});

		it("should handle processing errors and log them", async () => {
			const mockLockQuery: any = {
				where: vi.fn().mockReturnThis(),
				orWhere: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockReturnThis(),
				limit: vi.fn().mockReturnThis(),
				update: vi.fn().mockRejectedValue(new Error("Lock failed"))
			};

			(database.table as any).mockReturnValue(mockLockQuery);

			await processJobsNotifications();

			expect(logger.insert).toHaveBeenCalledWith(
				"INSTANCE",
				"ERROR",
				"Failed to process jobs notifications queue!",
				expect.any(Object)
			);
		});

		it("should respect process_limit configuration", async () => {
			const mockLockQuery: any = {
				where: vi.fn().mockReturnThis(),
				orWhere: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockReturnThis(),
				limit: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(10)
			};

			const mockSelectQuery: any = {
				where: vi.fn().mockResolvedValue([])
			};

			const mockReleaseQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(0)
			};

			(database.table as any)
				.mockReturnValueOnce(mockLockQuery)
				.mockReturnValueOnce(mockSelectQuery)
				.mockReturnValueOnce(mockReleaseQuery);

			await processJobsNotifications();

			expect(mockLockQuery.limit).toHaveBeenCalledWith(10);
		});

		it("should order notifications by priority and created_at", async () => {
			const mockLockQuery: any = {
				where: vi.fn().mockReturnThis(),
				orWhere: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockReturnThis(),
				limit: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(0)
			};

			const mockSelectQuery: any = {
				where: vi.fn().mockResolvedValue([])
			};

			const mockReleaseQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(0)
			};

			(database.table as any)
				.mockReturnValueOnce(mockLockQuery)
				.mockReturnValueOnce(mockSelectQuery)
				.mockReturnValueOnce(mockReleaseQuery);

			await processJobsNotifications();

			expect(mockLockQuery.orderBy).toHaveBeenCalledWith("priority", "asc");
			expect(mockLockQuery.orderBy).toHaveBeenCalledWith("created_at", "asc");
		});
	});
});
