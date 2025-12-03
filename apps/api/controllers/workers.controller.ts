import { Request, Response } from "express";
import { sanitizeData, logger } from "@voltage/utils";
import { sendSuccess, sendError } from "@/utils/response.util";
import * as workersService from "@/services/workers.service";

export const getWorker = async (req: Request, res: Response) => {
	try {
		const worker_key = (req.query.worker_key || req.body.worker_key || "").trim();
		const worker = await workersService.getWorker(worker_key);

		return sendSuccess(res, sanitizeData(worker));
	} catch (error: any) {
		if (error.message === "NOT_FOUND") {
			return sendError(res, 404, "NOT_FOUND", "Worker not found!");
		}

		await logger.insert("ERROR", "Failed to fetch worker!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to fetch worker!");
	}
};

export const getWorkers = async (req: Request, res: Response) => {
	try {
		const worker_key = (req.query.worker_key || req.body.worker_key || "").trim();

		// if worker_key provided, fetch only that instance and return as object (not array)
		if (worker_key) {
			return getWorker(req, res);
		}

		const instance_key = (req.query.instance_key || req.body.instance_key || "").trim();
		const workers = await workersService.getWorkers(instance_key);

		return sendSuccess(res, sanitizeData(workers));
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to fetch workers!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to fetch workers!");
	}
};

export const deleteWorkers = async (req: Request, res: Response) => {
	try {
		const params = {
			all: req.query.all || req.body.all,
			instance_key: (req.query.instance_key || req.body.instance_key || "").trim(),
			worker_key: (req.query.worker_key || req.body.worker_key || "").trim()
		};

		const result = await workersService.deleteWorkers(params);

		return sendSuccess(res, undefined, undefined, result.message);
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to delete workers!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to delete workers!");
	}
};
