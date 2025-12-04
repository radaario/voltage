import { Request, Response } from "express";
import { sanitizeData, logger } from "@voltage/utils";
import { sendSuccess, sendError } from "@/utils/response.util.js";
import * as statsService from "@/services/stats.service.js";

export const getStats = async (req: Request, res: Response) => {
	try {
		let since_at = (req.query.since_at || req.body.since_at || "").trim();
		let until_at = (req.query.until_at || req.body.until_at || "").trim();

		const result = await statsService.getStats(since_at, until_at);

		return sendSuccess(res, sanitizeData(result.stats), { since_at: result.since_at, until_at: result.until_at });
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to fetch stats!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to fetch stats!");
	}
};

export const deleteStats = async (req: Request, res: Response) => {
	try {
		const params = {
			all: req.query.all || req.body.all,
			stat_key: (req.query.stat_key || req.body.stat_key || "").trim(),
			date: (req.query.date || req.body.date || "").trim(),
			since_at: (req.query.since_at || req.body.since_at || "").trim(),
			until_at: (req.query.until_at || req.body.until_at || "").trim()
		};

		const result = await statsService.deleteStats(params);

		const metadata: any = {};
		if (result.since_at) metadata.since_at = result.since_at;
		if (result.until_at) metadata.until_at = result.until_at;

		return sendSuccess(res, undefined, metadata, result.message);
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to delete stats!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to delete stats!");
	}
};
