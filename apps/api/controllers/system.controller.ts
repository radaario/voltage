import { Request, Response } from "express";
import { logger } from "@voltage/utils";
import { sendSuccess, sendError } from "@/utils/response.util.js";
import * as systemService from "@/services/system.service.js";

export const deleteAllData = async (req: Request, res: Response) => {
	try {
		const result = await systemService.deleteAllData();
		return sendSuccess(res, undefined, undefined, result.message);
	} catch (error: Error | any) {
		await logger.insert("API", "ERROR", "Failed to delete all data!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to delete all data!");
	}
};
