import { Request, Response, NextFunction } from "express";
import { logger } from "@voltage/utils";
import { sendError } from "@/utils/response.util.js";

export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
	logger.insert("API", "ERROR", "An error occurred on API service!", { ...error });
	return sendError(res, 500, "INTERNAL_ERROR", "An error occurred on API service!");
};
