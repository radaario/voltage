import { describe, it, expect, beforeEach, vi } from "vitest";

const mockDatabase = {
	table: vi.fn()
};

const mockStorage = {
	config: vi.fn().mockResolvedValue(undefined),
	delete: vi.fn().mockResolvedValue(undefined)
};

const mockLogger = {
	insert: vi.fn().mockResolvedValue(undefined)
};

const mockConfig = {
	storage: {
		type: "local",
		path: "/storage"
	}
};

vi.mock("@voltage/core/config", () => ({
	config: mockConfig
}));

vi.mock("@voltage/utils", () => ({
	database: mockDatabase,
	storage: mockStorage,
	logger: mockLogger
}));

describe("System Service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("deleteAllData", () => {
		it("should delete all data from all tables", async () => {
			const mockQuery = {
				delete: vi.fn().mockResolvedValue(undefined)
			};

			mockDatabase.table.mockReturnValue(mockQuery);

			const { deleteAllData } = await import("../system.service");

			const result = await deleteAllData();

			// Verify all tables are deleted
			expect(mockDatabase.table).toHaveBeenCalledWith("stats");
			expect(mockDatabase.table).toHaveBeenCalledWith("logs");
			expect(mockDatabase.table).toHaveBeenCalledWith("instances");
			expect(mockDatabase.table).toHaveBeenCalledWith("instances_workers");
			expect(mockDatabase.table).toHaveBeenCalledWith("jobs");
			expect(mockDatabase.table).toHaveBeenCalledWith("jobs_queue");
			expect(mockDatabase.table).toHaveBeenCalledWith("jobs_outputs");
			expect(mockDatabase.table).toHaveBeenCalledWith("jobs_notifications");
			expect(mockDatabase.table).toHaveBeenCalledWith("jobs_notifications_queue");

			// Verify storage deletion
			expect(mockStorage.config).toHaveBeenCalledWith(mockConfig.storage);
			expect(mockStorage.delete).toHaveBeenCalledWith("/jobs");

			// Verify logging
			expect(mockLogger.insert).toHaveBeenCalledWith("API", "WARNING", "All data deleted!");

			// Verify return message
			expect(result.message).toBe("All data successfully deleted!");
		});

		it("should continue if storage deletion fails", async () => {
			const mockQuery = {
				delete: vi.fn().mockResolvedValue(undefined)
			};

			mockDatabase.table.mockReturnValue(mockQuery);
			mockStorage.delete.mockRejectedValueOnce(new Error("Storage error"));

			const { deleteAllData } = await import("../system.service");

			// Should not throw error
			const result = await deleteAllData();

			// Should still complete and return message
			expect(result.message).toBe("All data successfully deleted!");
			expect(mockLogger.insert).toHaveBeenCalled();
		});

		it("should delete data in correct order", async () => {
			const deleteCalls: string[] = [];
			const mockQuery = {
				delete: vi.fn().mockImplementation(() => {
					deleteCalls.push("deleted");
					return Promise.resolve(undefined);
				})
			};

			mockDatabase.table.mockImplementation((tableName: string) => {
				deleteCalls.push(tableName);
				return mockQuery;
			});

			const { deleteAllData } = await import("../system.service");

			await deleteAllData();

			// Verify stats and logs deleted before jobs
			const statsIndex = deleteCalls.indexOf("stats");
			const logsIndex = deleteCalls.indexOf("logs");
			const jobsIndex = deleteCalls.indexOf("jobs");

			expect(statsIndex).toBeLessThan(jobsIndex);
			expect(logsIndex).toBeLessThan(jobsIndex);
		});
	});
});
