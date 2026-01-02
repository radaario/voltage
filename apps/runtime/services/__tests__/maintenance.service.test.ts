import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { database, logger, getInstanceKey } from "@voltage/utils";
import { config as appConfig } from "@voltage/core/config";

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
	getNow: vi.fn(() => "2025-01-01T00:00:00.000Z"),
	subtractNow: vi.fn((ms) => new Date(Date.now() - ms).toISOString())
}));

vi.mock("@voltage/core/config", () => ({
	config: {
		runtime: {
			online_timeout: 15 * 1000,
			workers: {
				max: 5
			}
		}
	}
}));

vi.mock("@/services/instances.service.js", () => ({
	initInstance: vi.fn().mockResolvedValue({ key: "test-instance-key", type: "WORKER", status: "ONLINE" }),
	maintainInstance: vi.fn().mockResolvedValue(true),
	getMasterInstance: vi.fn().mockResolvedValue({ key: "master-instance", type: "MASTER" }),
	setMasterInstance: vi.fn().mockResolvedValue(true)
}));

vi.mock("@/services/workers.service.js", () => ({
	timeoutBusyWorkers: vi.fn().mockResolvedValue(["worker1", "worker2"]),
	idleTimeoutWorkers: vi.fn().mockResolvedValue(true),
	terminateInactiveInstanceWorkers: vi.fn().mockResolvedValue(true)
}));

describe("Maintenance Service", () => {
	let maintainInstancesAndWorkers: any;

	beforeEach(async () => {
		vi.clearAllMocks();
		const module = await import("../maintenance.service.js");
		maintainInstancesAndWorkers = module.maintainInstancesAndWorkers;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("maintainInstancesAndWorkers", () => {
		it("should maintain instances and workers as master", async () => {
			const mockInstances = [{ key: "test-instance-key", type: "WORKER", status: "ONLINE", updated_at: "2025-01-01T00:00:00.000Z" }];

			const mockSelectQuery: any = {
				select: vi.fn().mockResolvedValue(mockInstances)
			};

			const mockOfflineQuery: any = {
				where: vi.fn().mockReturnThis(),
				select: vi.fn().mockResolvedValue([])
			};

			const { getMasterInstance } = await import("@/services/instances.service.js");
			(getMasterInstance as any).mockResolvedValueOnce({ key: "test-instance-key", type: "MASTER" });

			(database.table as any).mockReturnValueOnce(mockSelectQuery).mockReturnValueOnce(mockOfflineQuery);

			await maintainInstancesAndWorkers();

			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "Maintaining instances and workers...");
			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "Maintaining workers...");
			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "Maintaining instances...");
		});

		it("should initialize self instance when not found", async () => {
			const mockSelectQuery: any = {
				select: vi.fn().mockResolvedValue([])
			};

			const mockOfflineQuery: any = {
				where: vi.fn().mockReturnThis(),
				select: vi.fn().mockResolvedValue([])
			};

			const { initInstance, getMasterInstance } = await import("@/services/instances.service.js");
			(getMasterInstance as any).mockResolvedValueOnce({ key: "test-instance-key", type: "MASTER" });

			(database.table as any).mockReturnValueOnce(mockSelectQuery).mockReturnValueOnce(mockOfflineQuery);

			await maintainInstancesAndWorkers();

			expect(initInstance).toHaveBeenCalledWith("test-instance-key");
		});

		it("should set self as master when no master exists", async () => {
			const mockInstances = [{ key: "test-instance-key", type: "WORKER", status: "ONLINE", updated_at: "2025-01-01T00:00:00.000Z" }];

			const mockSelectQuery: any = {
				select: vi.fn().mockResolvedValue(mockInstances)
			};

			const mockOfflineQuery: any = {
				where: vi.fn().mockReturnThis(),
				select: vi.fn().mockResolvedValue([])
			};

			const { getMasterInstance, setMasterInstance } = await import("@/services/instances.service.js");
			(getMasterInstance as any).mockResolvedValueOnce(null);

			(database.table as any).mockReturnValueOnce(mockSelectQuery).mockReturnValueOnce(mockOfflineQuery);

			await maintainInstancesAndWorkers();

			expect(setMasterInstance).toHaveBeenCalledWith("test-instance-key");
		});

		it("should terminate inactive instance workers", async () => {
			const mockInstances = [{ key: "test-instance-key", type: "WORKER", status: "ONLINE", updated_at: "2025-01-01T00:00:00.000Z" }];

			const mockSelectQuery: any = {
				select: vi.fn().mockResolvedValue(mockInstances)
			};

			const inactiveInstances = [{ key: "inactive-instance" }];
			const mockOfflineQuery: any = {
				where: vi.fn().mockReturnThis(),
				select: vi.fn().mockResolvedValue(inactiveInstances)
			};

			const mockUpdateQuery: any = {
				whereIn: vi.fn().mockReturnThis(),
				update: vi.fn().mockResolvedValue(1)
			};

			const { getMasterInstance } = await import("@/services/instances.service.js");
			const { terminateInactiveInstanceWorkers } = await import("@/services/workers.service.js");
			(getMasterInstance as any).mockResolvedValueOnce({ key: "test-instance-key", type: "MASTER" });

			(database.table as any)
				.mockReturnValueOnce(mockSelectQuery)
				.mockReturnValueOnce(mockOfflineQuery)
				.mockReturnValueOnce(mockUpdateQuery);

			await maintainInstancesAndWorkers();

			expect(terminateInactiveInstanceWorkers).toHaveBeenCalledWith(["inactive-instance"]);
		});

		it("should handle database errors gracefully", async () => {
			const mockSelectQuery: any = {
				select: vi.fn().mockRejectedValue(new Error("Database error"))
			};

			(database.table as any).mockReturnValue(mockSelectQuery);

			await expect(maintainInstancesAndWorkers()).resolves.toBeUndefined();

			expect(logger.console).toHaveBeenCalledWith("INSTANCE", "INFO", "Maintaining instances and workers...");
		});

		it("should skip master tasks when another instance is master", async () => {
			const mockInstances = [
				{ key: "test-instance-key", type: "WORKER", status: "ONLINE", updated_at: "2025-01-01T00:00:00.000Z" },
				{ key: "master-instance", type: "MASTER", status: "ONLINE", updated_at: "2025-01-01T00:00:00.000Z" }
			];

			const mockSelectQuery: any = {
				select: vi.fn().mockResolvedValue(mockInstances)
			};

			const { getMasterInstance } = await import("@/services/instances.service.js");
			const { timeoutBusyWorkers } = await import("@/services/workers.service.js");
			(getMasterInstance as any).mockResolvedValueOnce({ key: "master-instance", type: "MASTER" });

			(database.table as any).mockReturnValue(mockSelectQuery);

			await maintainInstancesAndWorkers();

			expect(timeoutBusyWorkers).not.toHaveBeenCalled();
		});
	});
});
