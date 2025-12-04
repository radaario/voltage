import { Request, Response } from "express";
import { sanitizeData, logger } from "@voltage/utils";
import { sendSuccess, sendError, sendPaginatedSuccess } from "@/utils/response.util.js";
import { getPaginationParams } from "@/utils/pagination.util.js";
import * as logsService from "@/services/logs.service.js";

export const getLog = async (req: Request, res: Response) => {
	try {
		const log_key = (req.query.log_key || req.body.log_key || "").trim();
		const log = await logsService.getLog(log_key);

		return sendSuccess(res, sanitizeData(log));
	} catch (error: any) {
		if (error.message === "NOT_FOUND") {
			return sendError(res, 404, "NOT_FOUND", "Log not found!");
		}
		await logger.insert("ERROR", "Failed to fetch log!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to fetch log!");
	}
};

export const getLogs = async (req: Request, res: Response) => {
	try {
		const log_key = (req.query.log_key || req.body.log_key || "").trim();

		// if log_key provided, fetch only that instance and return as object (not array)
		if (log_key) {
			return getLog(req, res);
		}

		const pagination = getPaginationParams(req);
		const filters = {
			instance_key: (req.query.instance_key || req.body.instance_key || "").trim(),
			worker_key: (req.query.worker_key || req.body.worker_key || "").trim(),
			job_key: (req.query.job_key || req.body.job_key || "").trim(),
			output_key: (req.query.output_key || req.body.output_key || "").trim(),
			notification_key: (req.query.notification_key || req.body.notification_key || "").trim(),
			type: (req.query.type || req.body.type || "").trim(),
			q: req.query.q ? String(req.query.q).trim() : ""
		};

		const result = await logsService.getLogs(pagination, filters);

		return sendPaginatedSuccess(res, sanitizeData(result.logs), {
			limit: pagination.limit,
			page: pagination.page,
			total: result.total
		});
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to fetch logs!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to fetch logs!");
	}
};

export const deleteLogs = async (req: Request, res: Response) => {
	try {
		const params = {
			all: req.query.all || req.body.all,
			log_key: req.query.log_key || req.body.log_key,
			since_at: (req.query.since_at || req.body.since_at || "").trim(),
			until_at: (req.query.until_at || req.body.until_at || "").trim()
		};

		const result = await logsService.deleteLogs(params);

		const metadata: any = {};
		if (result.since_at) metadata.since_at = result.since_at;
		if (result.until_at) metadata.until_at = result.until_at;

		return sendSuccess(res, undefined, metadata, result.message);
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to delete logs!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to delete logs!");
	}
};
