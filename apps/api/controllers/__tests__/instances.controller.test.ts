import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";

vi.mock("@voltage/utils", () => ({
	sanitizeData: vi.fn((data) => data),
	logger: {
		insert: vi.fn().mockResolvedValue(undefined)
	}
}));

vi.mock("../../utils/response.util", () => ({
	sendSuccess: vi.fn((res, data, metadata, message) => {
		res.json({ success: true, data, metadata, message });
	}),
	sendError: vi.fn((res, status, code, message) => {
		res.status(status).json({ error: { code, message } });
	})
}));

vi.mock("../../services/instances.service", () => ({
	getInstance: vi.fn(),
	getInstances: vi.fn(),
	deleteInstances: vi.fn()
}));

describe("Instances Controller", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;

	beforeEach(() => {
		mockReq = {
			query: {},
			body: {}
		};
		mockRes = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn()
		};
		vi.clearAllMocks();
	});

	describe("getInstance", () => {
		it("should return instance by key", async () => {
			const { getInstance } = await import("../instances.controller");
			const { sendSuccess } = await import("../../utils/response.util");
			const instancesService = await import("../../services/instances.service");

			const mockInstance = {
				key: "instance-1",
				status: "ONLINE",
				workers: []
			};

			(instancesService.getInstance as any).mockResolvedValueOnce(mockInstance);
			mockReq.query = { instance_key: "instance-1" };

			await getInstance(mockReq as Request, mockRes as Response);

			expect(instancesService.getInstance).toHaveBeenCalledWith("instance-1");
			expect(sendSuccess).toHaveBeenCalledWith(mockRes, mockInstance);
		});

		it("should return 404 for non-existent instance", async () => {
			const { getInstance } = await import("../instances.controller");
			const { sendError } = await import("../../utils/response.util");
			const instancesService = await import("../../services/instances.service");

			(instancesService.getInstance as any).mockRejectedValueOnce(new Error("NOT_FOUND"));
			mockReq.query = { instance_key: "non-existent" };

			await getInstance(mockReq as Request, mockRes as Response);

			expect(sendError).toHaveBeenCalledWith(mockRes, 404, "NOT_FOUND", "Instance not found!");
		});

		it("should handle internal errors", async () => {
			const { getInstance } = await import("../instances.controller");
			const { sendError } = await import("../../utils/response.util");
			const instancesService = await import("../../services/instances.service");
			const { logger } = await import("@voltage/utils");

			const error = new Error("Database error");
			(instancesService.getInstance as any).mockRejectedValueOnce(error);
			mockReq.body = { instance_key: "instance-1" };

			await getInstance(mockReq as Request, mockRes as Response);

			expect(logger.insert).toHaveBeenCalledWith("API", "ERROR", "Failed to fetch instance!", { ...error });
			expect(sendError).toHaveBeenCalledWith(mockRes, 500, "INTERNAL_ERROR", "Database error");
		});
	});

	describe("getInstances", () => {
		it("should return all instances", async () => {
			const { getInstances } = await import("../instances.controller");
			const { sendSuccess } = await import("../../utils/response.util");
			const instancesService = await import("../../services/instances.service");

			const mockInstances = [
				{ key: "instance-1", status: "ONLINE" },
				{ key: "instance-2", status: "OFFLINE" }
			];

			(instancesService.getInstances as any).mockResolvedValueOnce(mockInstances);

			await getInstances(mockReq as Request, mockRes as Response);

			expect(instancesService.getInstances).toHaveBeenCalledWith("");
			expect(sendSuccess).toHaveBeenCalledWith(mockRes, mockInstances);
		});

		it("should filter instances by search query", async () => {
			const { getInstances } = await import("../instances.controller");
			const instancesService = await import("../../services/instances.service");

			(instancesService.getInstances as any).mockResolvedValueOnce([]);
			mockReq.query = { q: "master" };

			await getInstances(mockReq as Request, mockRes as Response);

			expect(instancesService.getInstances).toHaveBeenCalledWith("master");
		});

		it("should delegate to getInstance when instance_key provided", async () => {
			const { getInstances } = await import("../instances.controller");
			const instancesService = await import("../../services/instances.service");

			const mockInstance = { key: "instance-1", status: "ONLINE" };
			(instancesService.getInstance as any).mockResolvedValueOnce(mockInstance);
			mockReq.query = { instance_key: "instance-1" };

			await getInstances(mockReq as Request, mockRes as Response);

			expect(instancesService.getInstance).toHaveBeenCalledWith("instance-1");
		});

		it("should handle errors", async () => {
			const { getInstances } = await import("../instances.controller");
			const { sendError } = await import("../../utils/response.util");
			const instancesService = await import("../../services/instances.service");
			const { logger } = await import("@voltage/utils");

			const error = new Error("Fetch failed");
			(instancesService.getInstances as any).mockRejectedValueOnce(error);

			await getInstances(mockReq as Request, mockRes as Response);

			expect(logger.insert).toHaveBeenCalled();
			expect(sendError).toHaveBeenCalledWith(mockRes, 500, "INTERNAL_ERROR", "Fetch failed");
		});
	});

	describe("deleteInstances", () => {
		it("should delete all instances when all=true", async () => {
			const { deleteInstances } = await import("../instances.controller");
			const { sendSuccess } = await import("../../utils/response.util");
			const instancesService = await import("../../services/instances.service");

			(instancesService.deleteInstances as any).mockResolvedValueOnce({
				message: "All instances deleted"
			});

			mockReq.query = { all: "true" };

			await deleteInstances(mockReq as Request, mockRes as Response);

			expect(instancesService.deleteInstances).toHaveBeenCalledWith({
				all: "true",
				instance_key: ""
			});
			expect(sendSuccess).toHaveBeenCalledWith(mockRes, undefined, undefined, "All instances deleted");
		});

		it("should delete specific instance by key", async () => {
			const { deleteInstances } = await import("../instances.controller");
			const instancesService = await import("../../services/instances.service");

			(instancesService.deleteInstances as any).mockResolvedValueOnce({
				message: "Instance deleted"
			});

			mockReq.body = { instance_key: "instance-1" };

			await deleteInstances(mockReq as Request, mockRes as Response);

			expect(instancesService.deleteInstances).toHaveBeenCalledWith({
				all: undefined,
				instance_key: "instance-1"
			});
		});

		it("should handle deletion errors", async () => {
			const { deleteInstances } = await import("../instances.controller");
			const { sendError } = await import("../../utils/response.util");
			const instancesService = await import("../../services/instances.service");

			const error = new Error("Delete failed");
			(instancesService.deleteInstances as any).mockRejectedValueOnce(error);

			mockReq.query = { instance_key: "instance-1" };

			await deleteInstances(mockReq as Request, mockRes as Response);

			expect(sendError).toHaveBeenCalledWith(mockRes, 500, "INTERNAL_ERROR", "Delete failed");
		});
	});
});
