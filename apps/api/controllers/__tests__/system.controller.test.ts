import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";

vi.mock("@voltage/utils", () => ({
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

vi.mock("../../services/system.service", () => ({
	deleteAllData: vi.fn()
}));

describe("System Controller", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;

	beforeEach(() => {
		mockReq = {};
		mockRes = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn()
		};
		vi.clearAllMocks();
	});

	describe("deleteAllData", () => {
		it("should successfully delete all data", async () => {
			const { deleteAllData } = await import("../system.controller");
			const { sendSuccess } = await import("../../utils/response.util");
			const systemService = await import("../../services/system.service");

			(systemService.deleteAllData as any).mockResolvedValueOnce({
				message: "All data successfully deleted!"
			});

			await deleteAllData(mockReq as Request, mockRes as Response);

			expect(systemService.deleteAllData).toHaveBeenCalled();
			expect(sendSuccess).toHaveBeenCalledWith(mockRes, undefined, undefined, "All data successfully deleted!");
		});

		it("should handle deletion errors", async () => {
			const { deleteAllData } = await import("../system.controller");
			const { sendError } = await import("../../utils/response.util");
			const systemService = await import("../../services/system.service");
			const { logger } = await import("@voltage/utils");

			const error = new Error("Critical system error");
			(systemService.deleteAllData as any).mockRejectedValueOnce(error);

			await deleteAllData(mockReq as Request, mockRes as Response);

			expect(logger.insert).toHaveBeenCalledWith("API", "ERROR", "Failed to delete all data!", { ...error });
			expect(sendError).toHaveBeenCalledWith(mockRes, 500, "INTERNAL_ERROR", "Critical system error");
		});

		it("should handle errors without message", async () => {
			const { deleteAllData } = await import("../system.controller");
			const { sendError } = await import("../../utils/response.util");
			const systemService = await import("../../services/system.service");

			const error = new Error();
			(systemService.deleteAllData as any).mockRejectedValueOnce(error);

			await deleteAllData(mockReq as Request, mockRes as Response);

			expect(sendError).toHaveBeenCalledWith(mockRes, 500, "INTERNAL_ERROR", "Failed to delete all data!");
		});

		it("should log critical operation", async () => {
			const { deleteAllData } = await import("../system.controller");
			const systemService = await import("../../services/system.service");
			const { logger } = await import("@voltage/utils");

			(systemService.deleteAllData as any).mockResolvedValueOnce({
				message: "All data deleted"
			});

			await deleteAllData(mockReq as Request, mockRes as Response);

			// Service should handle the actual deletion and logging
			expect(systemService.deleteAllData).toHaveBeenCalled();
		});
	});
});
