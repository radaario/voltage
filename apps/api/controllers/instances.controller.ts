import { Request, Response } from "express";
import { sanitizeData, logger } from "@voltage/utils";
import { sendSuccess, sendError } from "@/utils/response.util";
import * as instancesService from "@/services/instances.service";

export const getInstance = async (req: Request, res: Response) => {
	try {
		const instance_key = (req.query.instance_key || req.body.instance_key || "").trim();
		const instance = await instancesService.getInstance(instance_key);

		return sendSuccess(res, sanitizeData(instance));
	} catch (error: any) {
		if (error.message === "NOT_FOUND") {
			return sendError(res, 404, "NOT_FOUND", "Instance not found!");
		}
		await logger.insert("ERROR", "Failed to fetch instance!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to fetch instance!");
	}
};

export const getInstances = async (req: Request, res: Response) => {
	try {
		const q = req.query.q ? String(req.query.q).trim() : "";
		const instances = await instancesService.getInstances(q);

		return sendSuccess(res, sanitizeData(instances));
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to fetch instances!", { ...error });
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
		await logger.insert("ERROR", "Failed to delete instances!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to delete instances!");
	}
};
