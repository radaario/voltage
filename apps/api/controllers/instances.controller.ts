import { Request, Response } from "express";
import { sanitizeData, logger } from "@voltage/utils";
import { sendSuccess, sendError } from "@/utils/response.util.js";
import * as instancesService from "@/services/instances.service.js";

export const getInstance = async (req: Request, res: Response) => {
	try {
		const instance_key = (req.query.instance_key || req.body.instance_key || "").trim();
		const instance = await instancesService.getInstance(instance_key);

		return sendSuccess(res, sanitizeData(instance));
	} catch (error: Error | any) {
		if (error.message === "NOT_FOUND") {
			return sendError(res, 404, "NOT_FOUND", "Instance not found!");
		}
		await logger.insert("API", "ERROR", "Failed to fetch instance!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to fetch instance!");
	}
};

export const getInstances = async (req: Request, res: Response) => {
	try {
		const instance_key = (req.query.instance_key || req.body.instance_key || "").trim();

		// if instance_key provided, fetch only that instance and return as object (not array)
		if (instance_key) {
			return getInstance(req, res);
		}

		const q = req.query.q ? String(req.query.q).trim() : "";
		const instances = await instancesService.getInstances(q);

		return sendSuccess(res, sanitizeData(instances));
	} catch (error: Error | any) {
		await logger.insert("API", "ERROR", "Failed to fetch instances!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to fetch instances!");
	}
};

export const deleteInstances = async (req: Request, res: Response) => {
	try {
		const params = {
			all: req.query.all || req.body.all,
			instance_key: (req.query.instance_key || req.body.instance_key || "").trim()
		};

		const result = await instancesService.deleteInstances(params);

		return sendSuccess(res, undefined, undefined, result.message);
	} catch (error: Error | any) {
		await logger.insert("API", "ERROR", "Failed to delete instances!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to delete instances!");
	}
};

export const getWorker = async (req: Request, res: Response) => {
	try {
		const worker_key = (req.query.worker_key || req.body.worker_key || "").trim();
		const worker = await instancesService.getWorker(worker_key);

		return sendSuccess(res, sanitizeData(worker));
	} catch (error: any) {
		if (error.message === "NOT_FOUND") {
			return sendError(res, 404, "NOT_FOUND", "Worker not found!");
		}

		await logger.insert("API", "ERROR", "Failed to fetch worker!", { ...error });
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
		const workers = await instancesService.getWorkers(instance_key);

		return sendSuccess(res, sanitizeData(workers));
	} catch (error: Error | any) {
		await logger.insert("API", "ERROR", "Failed to fetch workers!", { ...error });
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

		const result = await instancesService.deleteWorkers(params);

		return sendSuccess(res, undefined, undefined, result.message);
	} catch (error: Error | any) {
		await logger.insert("API", "ERROR", "Failed to delete workers!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to delete workers!");
	}
};
