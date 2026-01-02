import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const mockDatabase = {
	table: vi.fn()
};

const mockLogger = {
	insert: vi.fn().mockResolvedValue(undefined)
};

vi.mock("@voltage/utils", () => ({
	database: mockDatabase,
	logger: mockLogger
}));

describe("Instances Service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getInstance", () => {
		it("should throw NOT_FOUND when instance does not exist", async () => {
			const mockQuery = {
				where: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue(null)
			};

			mockDatabase.table.mockReturnValue(mockQuery);

			const { getInstance } = await import("../instances.service");

			await expect(getInstance("non-existent")).rejects.toThrow("NOT_FOUND");
			expect(mockDatabase.table).toHaveBeenCalledWith("instances");
			expect(mockQuery.where).toHaveBeenCalledWith("key", "non-existent");
		});

		it("should return instance with workers", async () => {
			const mockInstance = {
				key: "instance-1",
				type: "MASTER",
				status: "ONLINE",
				specs: JSON.stringify({ cpu: 4 })
			};

			const mockWorkers = [
				{ instance_key: "instance-1", index: 0 },
				{ instance_key: "instance-1", index: 1 }
			];

			const mockInstanceQuery = {
				where: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue(mockInstance)
			};

			const mockWorkersQuery = {
				where: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockResolvedValue(mockWorkers)
			};

			mockDatabase.table.mockImplementation((tableName: string) => {
				if (tableName === "instances") return mockInstanceQuery;
				if (tableName === "instances_workers") return mockWorkersQuery;
			});

			const { getInstance } = await import("../instances.service");

			const result = await getInstance("instance-1");

			expect(result.key).toBe("instance-1");
			expect(result.workers).toEqual(mockWorkers);
			expect(result.specs).toEqual({ cpu: 4 });
		});
	});

	describe("getInstances", () => {
		it("should return empty array when no instances exist", async () => {
			const mockQuery = {
				orderByRaw: vi.fn()
			};

			// First orderByRaw returns this, second returns promise
			mockQuery.orderByRaw.mockReturnValueOnce(mockQuery).mockResolvedValueOnce([]);
			mockDatabase.table.mockReturnValue(mockQuery);

			const { getInstances } = await import("../instances.service");

			const result = await getInstances();

			expect(result).toEqual([]);
			expect(mockDatabase.table).toHaveBeenCalledWith("instances");
		});

		it("should apply search filter when q parameter provided", async () => {
			const mockQuery = {
				where: vi.fn().mockReturnThis(),
				orderByRaw: vi.fn()
			};

			// First orderByRaw returns this, second returns promise
			mockQuery.orderByRaw.mockReturnValueOnce(mockQuery).mockResolvedValueOnce([]);
			mockDatabase.table.mockReturnValue(mockQuery);

			const { getInstances } = await import("../instances.service");

			await getInstances("search-term");

			expect(mockQuery.where).toHaveBeenCalled();
		});
	});

	describe("deleteInstances", () => {
		it("should delete all instances when all=true", async () => {
			const mockInstancesQuery = {
				delete: vi.fn().mockResolvedValue(undefined)
			};

			const mockWorkersQuery = {
				delete: vi.fn().mockResolvedValue(undefined)
			};

			mockDatabase.table.mockImplementation((tableName: string) => {
				if (tableName === "instances") return mockInstancesQuery;
				if (tableName === "instances_workers") return mockWorkersQuery;
			});

			const { deleteInstances } = await import("../instances.service");

			const result = await deleteInstances({ all: true });

			expect(mockInstancesQuery.delete).toHaveBeenCalled();
			expect(mockWorkersQuery.delete).toHaveBeenCalled();
			expect(mockLogger.insert).toHaveBeenCalledWith("API", "WARNING", "All instances and workers successfully deleted!");
			expect(result.message).toBe("All instances and workers successfully deleted!");
		});

		it("should throw error when instance_key not provided and all is false", async () => {
			const { deleteInstances } = await import("../instances.service");

			await expect(deleteInstances({})).rejects.toThrow();
		});
	});
});
