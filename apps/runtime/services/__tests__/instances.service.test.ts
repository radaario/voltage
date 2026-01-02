import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { database, logger, getInstanceKey, getInstanceSpecs, getNow } from "@voltage/utils";

// Mock dependencies
vi.mock("@voltage/utils", () => ({
	database: {
		table: vi.fn(),
		knex: {
			raw: vi.fn((query) => query)
		}
	},
	logger: {
		console: vi.fn(),
		insert: vi.fn()
	},
	getInstanceKey: vi.fn(() => "test-instance-key"),
	getInstanceSpecs: vi.fn(() => ({ cpu: "test", memory: "test" })),
	getNow: vi.fn(() => "2025-01-01T00:00:00.000Z")
}));

vi.mock("../workers.service.js", () => ({
	maintainInstanceWorkers: vi.fn().mockResolvedValue(true)
}));

describe("Instances Service", () => {
	let initInstance: any;
	let restartInstance: any;
	let maintainInstance: any;

	beforeEach(async () => {
		vi.clearAllMocks();
		const module = await import("../instances.service.js");
		initInstance = module.initInstance;
		restartInstance = module.restartInstance;
		maintainInstance = module.maintainInstance;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("initInstance", () => {
		it("should create new instance when instance does not exist", async () => {
			const mockQuery: any = {
				insert: vi.fn().mockResolvedValue([1]),
				where: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({ key: "test-instance-key", status: "ONLINE" })
			};

			(database.table as any).mockReturnValue(mockQuery);

			const result = await initInstance("test-instance-key");

			expect(mockQuery.insert).toHaveBeenCalledWith(
				expect.objectContaining({
					key: "test-instance-key",
					status: "ONLINE"
				})
			);
			expect(logger.insert).toHaveBeenCalledWith("INSTANCE", "INFO", "Initializing instance...");
			expect(logger.insert).toHaveBeenCalledWith("INSTANCE", "INFO", "Instance created!");
			expect(result).toEqual({ key: "test-instance-key", status: "ONLINE" });
		});

		it("should restart existing instance when instance is provided", async () => {
			const existingInstance = { key: "test-instance-key", status: "OFFLINE", restart_count: 0 };

			const mockQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockImplementation((data) => {
					return Promise.resolve(1).then(async (result) => {
						await logger.insert("INSTANCE", "WARNING", expect.any(String));
						return result;
					});
				})
			};

			(database.table as any).mockReturnValue(mockQuery);

			const result = await initInstance("test-instance-key", existingInstance);

			expect(logger.insert).toHaveBeenCalledWith("INSTANCE", "INFO", "Initializing instance...");
			expect(logger.insert).toHaveBeenCalledWith("INSTANCE", "INFO", "Restarting instance...");
		});

		it("should handle initialization errors gracefully", async () => {
			const mockQuery: any = {
				insert: vi.fn().mockRejectedValue(new Error("Database error"))
			};

			(database.table as any).mockReturnValue(mockQuery);

			const result = await initInstance("test-instance-key");

			expect(logger.insert).toHaveBeenCalledWith(
				"INSTANCE",
				"ERROR",
				expect.stringContaining("initialization failed"),
				expect.any(Object)
			);
			expect(result).toBeUndefined();
		});
	});

	describe("restartInstance", () => {
		it("should return null when instance is not provided", async () => {
			const result = await restartInstance("test-instance-key", null);

			expect(result).toBeNull();
		});

		it("should update instance and increment restart count", async () => {
			const instance = { key: "test-instance-key", status: "OFFLINE", restart_count: 2 };

			const mockQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockImplementation((data) => {
					return Promise.resolve(1).then(async (result) => {
						await logger.insert("INSTANCE", "WARNING", expect.any(String));
						return result;
					});
				})
			};

			(database.table as any).mockReturnValue(mockQuery);

			const result = await restartInstance("test-instance-key", instance);

			expect(logger.insert).toHaveBeenCalledWith("INSTANCE", "INFO", "Restarting instance...");
			expect(mockQuery.update).toHaveBeenCalledWith(
				expect.objectContaining({
					status: "ONLINE",
					outcome: null
				})
			);
			expect(instance.restart_count).toBe(3);
		});

		it("should handle restart errors gracefully", async () => {
			const instance = { key: "test-instance-key", status: "OFFLINE", restart_count: 0 };

			const mockQuery: any = {
				where: vi.fn().mockReturnThis(),
				update: vi.fn().mockRejectedValue(new Error("Database error"))
			};

			(database.table as any).mockReturnValue(mockQuery);

			const result = await restartInstance("test-instance-key", instance);

			expect(result).toBeUndefined();
		});
	});

	describe("maintainInstance", () => {
		it("should log maintenance start message", async () => {
			await maintainInstance("test-instance-key");

			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "Maintaining instance...");
		});

		it("should handle different instance keys", async () => {
			await maintainInstance("another-instance-key");

			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "Maintaining instance (another-instance-key)...");
		});
	});
});
