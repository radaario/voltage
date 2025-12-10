import { Request, Response } from "express";
import { sanitizeData, logger, storage } from "@voltage/utils";
import { config } from "@voltage/config";
import { sendSuccess, sendError, sendPaginatedSuccess } from "@/utils/response.util.js";
import { getPaginationParams } from "@/utils/pagination.util.js";
import * as jobsService from "@/services/jobs.service.js";
import path from "path";

export const getJob = async (req: Request, res: Response) => {
	try {
		const job_key = (req.query.job_key || req.body.job_key || "").trim();
		const job = await jobsService.getJob(job_key);

		return sendSuccess(res, sanitizeData(job));
	} catch (error: any) {
		if (error.message === "NOT_FOUND") {
			return sendError(res, 404, "NOT_FOUND", "Job not found!");
		}
		await logger.insert("API", "ERROR", "Failed to fetch job!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to fetch job!");
	}
};

export const getJobs = async (req: Request, res: Response) => {
	try {
		const job_key = (req.query.job_key || req.body.job_key || "").trim();

		// if job_key provided, fetch only that job and return as object (not array)
		if (job_key) {
			return getJob(req, res);
		}

		const pagination = getPaginationParams(req);
		const filters = {
			status: (req.query.status || req.body.status || "").trim(),
			instance_key: (req.query.instance_key || req.body.instance_key || "").trim(),
			worker_key: (req.query.worker_key || req.body.worker_key || "").trim(),
			q: req.query.q ? String(req.query.q).trim() : ""
		};

		const jobs = await jobsService.getJobs(pagination, filters);

		return sendPaginatedSuccess(res, sanitizeData(jobs.data), {
			limit: pagination.limit,
			page: pagination.page,
			total: jobs.total
		});
	} catch (error: Error | any) {
		await logger.insert("API", "ERROR", "Failed to fetch jobs!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to fetch jobs!");
	}
};

export const createJob = async (req: Request, res: Response) => {
	try {
		const job = await jobsService.createJob(req.body);

		return res.status(202).json({
			metadata: { version: config.version, env: config.env, status: "SUCCESSFUL" },
			data: sanitizeData(job)
		});
	} catch (error: any) {
		if (error.message === "REQUEST_INVALID") {
			return sendError(res, 400, "REQUEST_INVALID", "Require input and outputs[]!");
		}
		if (error.message === "OUTPUT_REQUIRED") {
			return sendError(res, 400, "REQUEST_INVALID", "At least one output specification is required!");
		}
		await logger.insert("API", "ERROR", "Create job failed!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", "Job creation failed!");
	}
};

export const retryJob = async (req: Request, res: Response) => {
	try {
		const job_key = (req.query.job_key || req.body.job_key || "").trim();
		const output_key = (req.query.output_key || req.body.output_key || "").trim();

		await jobsService.retryJob(job_key, output_key);

		return sendSuccess(res);
	} catch (error: any) {
		if (error.message === "KEY_REQUIRED") {
			return sendError(res, 400, "KEY_REQUIRED", "Job key required!");
		}
		if (error.message === "NOT_FOUND") {
			return sendError(res, 404, "NOT_FOUND", "Job not found!");
		}
		if (error.message === "NOT_ALLOWED") {
			return sendError(res, 405, "NOT_ALLOWED", "Job cannot be reprocessed!");
		}
		await logger.insert("API", "ERROR", "Failed to retry job!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to retry job!");
	}
};

export const deleteJobs = async (req: Request, res: Response) => {
	try {
		const params = {
			all: req.query.all || req.body.all,
			job_key: (req.query.job_key || req.body.job_key || "").trim(),
			hard_delete: req.query.hard_delete || req.body.hard_delete,
			since_at: (req.query.since_at || req.body.since_at || "").trim(),
			until_at: (req.query.until_at || req.body.until_at || "").trim()
		};

		const result = await jobsService.deleteJobs(params);

		return sendSuccess(res, undefined, undefined, result.message);
	} catch (error: any) {
		if (error.message === "KEY_REQUIRED") {
			return sendError(res, 400, "KEY_REQUIRED", "Job key required!");
		}
		await logger.insert("API", "ERROR", "Failed to delete all jobs!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to delete all jobs!");
	}
};

export const getJobPreview = async (req: Request, res: Response) => {
	const job_key = (req.query.job_key || req.body.job_key || "").trim();

	const serveFallbackImage = () => {
		res.setHeader("Content-Type", "image/webp");
		res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
		res.sendFile(path.resolve(path.join(".", "assets", "no-preview.webp")));
	};

	try {
		if (job_key) {
			const job = await jobsService.getJob(job_key);

			if (!job) {
				return sendError(res, 404, "NOT_FOUND", "Job not found!");
			}

			try {
				const exists = await storage.exists(`/jobs/${job_key}/preview.${config.jobs.preview.format.toLowerCase()}`);
				if (!exists) return serveFallbackImage();

				const buffer = await storage.read(`/jobs/${job_key}/preview.${config.jobs.preview.format.toLowerCase()}`);

				res.setHeader("Content-Type", `image/${config.jobs.preview.format.toLowerCase()}`);
				// res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

				return res.send(buffer);
			} catch (error: Error | any) {}
		}
	} catch (error: Error | any) {}

	return serveFallbackImage();
};

export const getOutput = async (req: Request, res: Response) => {
	try {
		const output_key = (req.query.output_key || req.body.output_key || "").trim();
		const output = await jobsService.getOutput(output_key);

		return sendSuccess(res, sanitizeData(output));
	} catch (error: any) {
		if (error.message === "NOT_FOUND") {
			return sendError(res, 404, "NOT_FOUND", "Job output not found!");
		}
		await logger.insert("API", "ERROR", "Failed to fetch job output!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to fetch job output!");
	}
};

export const getOutputs = async (req: Request, res: Response) => {
	try {
		const output_key = (req.query.output_key || req.body.output_key || "").trim();

		// if output_key provided, fetch only that output and return as object (not array)
		if (output_key) {
			return getOutput(req, res);
		}

		const pagination = getPaginationParams(req);
		const filters = {
			job_key: (req.query.job_key || req.body.job_key || "").trim(),
			status: (req.query.status || req.body.status || "").trim(),
			instance_key: (req.query.instance_key || req.body.instance_key || "").trim(),
			worker_key: (req.query.worker_key || req.body.worker_key || "").trim(),
			q: req.query.q ? String(req.query.q).trim() : ""
		};

		const outputs = await jobsService.getOutputs(pagination, filters);

		if (filters.job_key) return sendSuccess(res, sanitizeData(outputs));

		return sendPaginatedSuccess(res, sanitizeData(outputs.data), {
			limit: pagination.limit,
			page: pagination.page,
			total: outputs.total
		});
	} catch (error: Error | any) {
		await logger.insert("API", "ERROR", "Failed to fetch jobs!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to fetch jobs!");
	}
};

export const getNotification = async (req: Request, res: Response) => {
	try {
		const notification_key = (req.query.notification_key || req.body.notification_key || "").trim();
		const notification = await jobsService.getNotification(notification_key);

		return sendSuccess(res, sanitizeData(notification));
	} catch (error: any) {
		if (error.message === "NOT_FOUND") {
			return sendError(res, 404, "NOT_FOUND", "Notification not found!");
		}
		await logger.insert("API", "ERROR", "Failed to fetch notification!", { ...error });
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
			job_key: (req.query.job_key || req.body.job_key || "").trim(),
			status: (req.query.status || req.body.status || "").trim(),
			instance_key: (req.query.instance_key || req.body.instance_key || "").trim(),
			worker_key: (req.query.worker_key || req.body.worker_key || "").trim(),
			q: req.query.q ? String(req.query.q).trim() : ""
		};

		const notifications = await jobsService.getNotifications(pagination, filters);

		return sendPaginatedSuccess(res, sanitizeData(notifications.data), {
			limit: pagination.limit,
			page: pagination.page,
			total: notifications.total
		});
	} catch (error: Error | any) {
		await logger.insert("API", "ERROR", "Failed to fetch job notifications!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to fetch job notifications!");
	}
};

export const retryNotification = async (req: Request, res: Response) => {
	try {
		const notification_key = (req.query.notification_key || req.body.notification_key || "").trim();
		const result = await jobsService.retryNotification(notification_key);

		return sendSuccess(res, undefined, undefined, result.message);
	} catch (error: any) {
		if (error.message === "KEY_REQUIRED") {
			return sendError(res, 400, "KEY_REQUIRED", "Notification key required!");
		}
		if (error.message === "NOT_FOUND") {
			return sendError(res, 404, "NOT_FOUND", "Notification not found!");
		}
		await logger.insert("API", "ERROR", "Failed to retry notification!", { ...error });
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

		const result = await jobsService.deleteNotifications(params);

		const metadata: any = {};
		if (result.since_at) metadata.since_at = result.since_at;
		if (result.until_at) metadata.until_at = result.until_at;

		return sendSuccess(res, undefined, metadata, result.message);
	} catch (error: Error | any) {
		await logger.insert("API", "ERROR", "Failed to delete job notifications!", { ...error });
		return sendError(res, 500, "INTERNAL_ERROR", error.message || "Failed to delete job notifications!");
	}
};
