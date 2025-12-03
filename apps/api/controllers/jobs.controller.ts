import { Request, Response } from "express";
import { sanitizeData, logger, storage } from "@voltage/utils";
import { config } from "@voltage/config";
import { sendSuccess, sendError, sendPaginatedSuccess } from "@/utils/response.util";
import { getPaginationParams } from "@/utils/pagination.util";
import * as jobsService from "@/services/jobs.service";
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
		await logger.insert("ERROR", "Failed to fetch job!", { ...error });
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
			instance_key: (req.query.instance_key || req.body.instance_key || "").trim(),
			worker_key: (req.query.worker_key || req.body.worker_key || "").trim(),
			status: (req.query.status || req.body.status || "").trim(),
			q: req.query.q ? String(req.query.q).trim() : ""
		};

		const result = await jobsService.getJobs(pagination, filters);

		return sendPaginatedSuccess(res, sanitizeData(result.jobs), {
			limit: pagination.limit,
			page: pagination.page,
			total: result.total
		});
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to fetch jobs!", { ...error });
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
		await logger.insert("ERROR", "Create job failed!", { ...error });
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
		await logger.insert("ERROR", "Failed to retry job!", { ...error });
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
		await logger.insert("ERROR", "Failed to delete all jobs!", { ...error });
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

				res.setHeader("Content-Type", "image/webp");
				res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

				return res.send(buffer);
			} catch (error: Error | any) {}
		}
	} catch (error: Error | any) {}

	return serveFallbackImage();
};
