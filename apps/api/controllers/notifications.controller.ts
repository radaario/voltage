import { Request, Response } from "express";
import { sanitizeData, logger } from "@voltage/utils";
import { sendSuccess, sendError, sendPaginatedSuccess } from "@/utils/response.util";
import { getPaginationParams } from "@/utils/pagination.util";
import * as notificationsService from "@/services/notifications.service";

export const getNotification = async (req: Request, res: Response) => {
	try {
		const notification_key = (req.query.notification_key || req.body.notification_key || "").trim();
		const notification = await notificationsService.getNotification(notification_key);

		return sendSuccess(res, sanitizeData(notification));
	} catch (error: any) {
		if (error.message === "NOT_FOUND") {
			return sendError(res, 404, "NOT_FOUND", "Notification not found!");
		}
		await logger.insert("ERROR", "Failed to fetch notification!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to fetch notification!");
	}
};

export const getNotifications = async (req: Request, res: Response) => {
	try {
		const notification_key = (req.query.notification_key || req.body.notification_key || "").trim();

		// if notification_key provided, fetch only that instance and return as object (not array)
		if (notification_key) {
			return getNotification(req, res);
		}

		const pagination = getPaginationParams(req);
		const filters = {
			instance_key: (req.query.instance_key || req.body.instance_key || "").trim(),
			worker_key: (req.query.worker_key || req.body.worker_key || "").trim(),
			job_key: (req.query.job_key || req.body.job_key || "").trim(),
			status: (req.query.status || req.body.status || "").trim(),
			q: req.query.q ? String(req.query.q).trim() : ""
		};

		const result = await notificationsService.getNotifications(pagination, filters);

		return sendPaginatedSuccess(res, sanitizeData(result.notifications), {
			limit: pagination.limit,
			page: pagination.page,
			total: result.total
		});
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to fetch job notifications!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to fetch job notifications!");
	}
};

export const retryNotification = async (req: Request, res: Response) => {
	try {
		const notification_key = (req.query.notification_key || req.body.notification_key || "").trim();
		const result = await notificationsService.retryNotification(notification_key);

		return sendSuccess(res, undefined, undefined, result.message);
	} catch (error: any) {
		if (error.message === "KEY_REQUIRED") {
			return sendError(res, 400, "KEY_REQUIRED", "Notification key required!");
		}
		if (error.message === "NOT_FOUND") {
			return sendError(res, 404, "NOT_FOUND", "Notification not found!");
		}
		await logger.insert("ERROR", "Failed to retry notification!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to retry notification!");
	}
};

export const deleteNotifications = async (req: Request, res: Response) => {
	try {
		const params = {
			all: req.query.all || req.body.all,
			notification_key: req.query.notification_key || req.body.notification_key,
			since_at: (req.query.since_at || req.body.since_at || "").trim(),
			until_at: (req.query.until_at || req.body.until_at || "").trim()
		};

		const result = await notificationsService.deleteNotifications(params);

		const metadata: any = {};
		if (result.since_at) metadata.since_at = result.since_at;
		if (result.until_at) metadata.until_at = result.until_at;

		return sendSuccess(res, undefined, metadata, result.message);
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to delete job notifications!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to delete job notifications!");
	}
};
