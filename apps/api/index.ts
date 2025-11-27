import "dotenv/config";
import { config } from "@voltage/config";
import { JobRequest, JobRow, OutputSpecs } from "@voltage/config/types";

import { storage, database, logger, stats } from "@voltage/utils";
import { getInstanceKey, sanitizeData, uuid, uukey, hash, getDate, getNow, subtractFrom } from "@voltage/utils";

import path from "path";
import "express-async-errors";
import express, { Request, Response } from "express";
import cors from "cors";
import { createJobNotification } from "@voltage/runtime/worker/notifier";

const responseMetadata = {
	version: config.version,
	env: config.env
};

// INSTANCE: KEY
const instance_key = getInstanceKey();

const app = express();

// Configure express.json() options via an array and apply when present
const expressOptions: any[] = [];
if (config.api.request_body_limit && parseInt(String(config.api.request_body_limit)) > 0) {
	expressOptions.push({ limit: `${config.api.request_body_limit}mb` });
}
app.use(express.json(...expressOptions));

// cors
app.use(cors());

// Authentication middleware factory
const authMiddleware = (options: {} = {}) => {
	return (req: Request, res: Response, next: any) => {
		const client = req.query.client?.toString().toUpperCase() || "FRONTEND"; // null /* ! */

		// Expected tokens
		const frontendToken = config.frontend.password ? hash(config.frontend.password) : null;
		const apiToken = client === "FRONTEND" ? frontendToken : config.api.key;

		if (!apiToken) {
			return next();
		}

		// Get token from various possible locations
		const token =
			req.query.token ||
			req.query.api_key ||
			req.body.token ||
			req.body.api_key ||
			req.headers.token ||
			req.headers.api_key ||
			req.headers["x-api-key"] ||
			(req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.substring(7) : null);

		if (!token) {
			return res.status(401).json({
				metadata: {
					...responseMetadata,
					status: "ERROR",
					error: { code: "AUTH_TOKEN_REQUIRED", message: "Authentication token required!" }
				}
			});
		}

		// Check if token matches either frontend token or API key
		if (token !== apiToken) {
			return res.status(401).json({
				metadata: {
					...responseMetadata,
					status: "ERROR",
					error: { code: "AUTH_TOKEN_INVALID", message: "Invalid authentication token!" }
				}
			});
		}

		next();
	};
};

// API: ROUTEs
// Support both /health and /status for health checks (some load balancers
// or orchestration systems expect one or the other).
app.get(["/status", "/health"], (req, res) => res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" } }));

app.get("/config", async (req, res) => {
	return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" }, data: sanitizeData(config) });
});

app.post("/auth", async (req, res) => {
	// Accept password from body, query string, or POST data
	const inputPassword = (req.query.password || req.body.password || "").trim();

	if (config.frontend.is_authentication_required) {
		if (!inputPassword) {
			return res.status(400).json({
				metadata: { ...responseMetadata, status: "ERROR", error: { code: "PASSWORD_REQUIRED", message: "Password required!" } }
			});
		}

		if (inputPassword === config.frontend.password) {
			const token = hash(inputPassword);
			return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" }, data: { token } });
		} else {
			return res.status(401).json({
				metadata: { ...responseMetadata, status: "ERROR", error: { code: "PASSWORD_INVALID", message: "Invalid password!" } }
			});
		}
	} else {
		return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" } });
	}
});

app.get("/stats", authMiddleware(), async (req, res) => {
	try {
		let since_at = (req.query.since_at || req.body.since_at || "").trim();
		let until_at = (req.query.until_at || req.body.until_at || "").trim();

		if (!until_at) until_at = getNow("YYYY-MM-DD");
		if (!since_at) since_at = subtractFrom(until_at, 1, "month", "YYYY-MM-DD");

		since_at = getDate(since_at, "YYYY-MM-DD");
		until_at = getDate(until_at, "YYYY-MM-DD");

		const stats = await database.table("stats").where("date", ">=", since_at).where("date", "<=", until_at).orderBy("date", "asc");

		return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL", since_at, until_at }, data: sanitizeData(stats) });
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to fetch logs!", { error });
		return res.status(500).json({
			metadata: {
				...responseMetadata,
				status: "ERROR",
				error: { code: "INTERNAL_ERROR", message: error.message || "Failed to fetch stats!" }
			}
		});
	}
});

app.delete("/stats/all", authMiddleware(), async (req, res) => {
	try {
		await database.table("stats").delete();
		return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" }, message: "All stats deleted successfully!" });
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to delete stats!", { error });
		return res.status(500).json({
			metadata: {
				...responseMetadata,
				status: "ERROR",
				error: { code: "INTERNAL_ERROR", message: error.message || "Failed to delete stats!" }
			}
		});
	}
});

app.get("/logs", authMiddleware(), async (req, res) => {
	try {
		const log_key = (req.query.log_key || req.body.log_key || "").trim();

		// If log_key provided, fetch only that log and return as object (not array)
		if (log_key) {
			const log = await database.table("logs").where("key", log_key).first();

			if (!log) {
				return res
					.status(404)
					.json({ metadata: { ...responseMetadata, status: "ERROR", error: { code: "NOT_FOUND", message: "Log not found!" } } });
			}

			return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" }, data: sanitizeData(log) });
		}

		const defaultLimit = 25;
		const rawLimit = req.query.limit;
		const rawPage = req.query.page;
		const instance_key = (req.query.instance_key || req.body.instance_key || "").trim();
		const worker_key = (req.query.worker_key || req.body.worker_key || "").trim();
		const job_key = (req.query.job_key || req.body.job_key || "").trim();
		const output_key = (req.query.output_key || req.body.output_key || "").trim();
		const notification_key = (req.query.notification_key || req.body.notification_key || "").trim();
		const type = (req.query.type || req.body.type || "").trim();
		const q = req.query.q ? String(req.query.q).trim() : "";

		let limit = rawLimit !== undefined ? parseInt(String(rawLimit), 10) : defaultLimit;
		if (isNaN(limit) || limit < 1) limit = defaultLimit;

		let page = rawPage !== undefined ? parseInt(String(rawPage), 10) : 1;
		if (isNaN(page) || page < 1) page = 1;

		const offset = (page - 1) * limit;

		// Build query with Knex
		let query = database.table("logs");

		if (type) query = query.where("type", type);
		if (instance_key) query = query.where("instance_key", instance_key);
		if (worker_key) query = query.where("worker_key", worker_key);
		if (job_key) query = query.where("job_key", job_key);
		if (output_key) query = query.where("output_key", output_key);
		if (notification_key) query = query.where("notification_key", notification_key);

		if (q) {
			const searchPattern = `%${q}%`;
			query = query.where(function () {
				this.where("key", "like", searchPattern)
					.orWhere("type", "like", searchPattern)
					.orWhere("instance_key", "like", searchPattern)
					.orWhere("worker_key", "like", searchPattern)
					.orWhere("job_key", "like", searchPattern)
					.orWhere("output_key", "like", searchPattern)
					.orWhere("notification_key", "like", searchPattern)
					.orWhere("message", "like", searchPattern)
					.orWhere("metadata", "like", searchPattern);
			});
		}

		// Get total count for pagination metadata
		const totalResult = await query.clone().count("* as total").first();
		const total = (totalResult as any).total;

		// Get paginated data
		const logs = await query.orderBy("created_at", "desc").limit(limit).offset(offset);

		// Calculate pagination metadata
		const totalPages = Math.ceil(total / limit);
		const hasMore = page < totalPages;
		const nextPage = hasMore ? page + 1 : null;
		const prevPage = page > 1 ? page - 1 : null;

		return res.json({
			metadata: { ...responseMetadata, status: "SUCCESSFUL" },
			data: sanitizeData(logs),
			pagination: {
				limit,
				page,
				total,
				total_pages: totalPages,
				has_more: hasMore,
				next_page: nextPage,
				prev_page: prevPage
			}
		});
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to fetch logs!", { error });
		return res.status(500).json({
			metadata: {
				...responseMetadata,
				status: "ERROR",
				error: { code: "INTERNAL_ERROR", message: error.message || "Failed to fetch logs!" }
			}
		});
	}
});

app.delete("/logs/all", authMiddleware(), async (req, res) => {
	try {
		await database.table("logs").delete();
		return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" }, message: "All logs deleted successfully!" });
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to delete logs!", { error });
		return res.status(500).json({
			metadata: {
				...responseMetadata,
				status: "ERROR",
				error: { code: "INTERNAL_ERROR", message: error.message || "Failed to delete logs!" }
			}
		});
	}
});

// Instance status endpoint - list all instances
app.get("/instances", authMiddleware(), async (req, res) => {
	try {
		const instance_key = (req.query.instance_key || req.body.instance_key || "").trim();
		const q = req.query.q ? String(req.query.q).trim() : "";

		// If instance_key provided, fetch only that instance and return as object (not array)
		if (instance_key) {
			const instance = await database.table("instances").where("key", instance_key).first();

			if (!instance) {
				return res.status(404).json({
					metadata: { ...responseMetadata, status: "ERROR", error: { code: "NOT_FOUND", message: "Instance not found!" } }
				});
			}

			const workers = await database.table("instances_workers").where("instance_key", instance_key).orderBy("index", "asc");

			const result = { ...instance, specs: instance.specs ? JSON.parse(instance.specs) : "{}", workers };

			return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" }, data: sanitizeData(result) });
		}

		let query = database.table("instances");

		if (q) {
			const searchPattern = `%${q}%`;
			query = query.where(function () {
				this.where("key", "like", searchPattern)
					.orWhere("type", "like", searchPattern)
					.orWhere("specs", "like", searchPattern)
					.orWhere("outcome", "like", searchPattern)
					.orWhere("status", "like", searchPattern);
			});
		}

		const instances = await query
			.orderByRaw("CASE WHEN type = 'MASTER' THEN 0 ELSE 1 END")
			.orderByRaw("CASE WHEN status = 'ONLINE' THEN 0 ELSE 1 END");
		// .orderBy("created_at", "desc");

		// If no instances, return empty array immediately
		if (instances.length === 0) {
			return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" }, data: [] });
		}

		// Collect instance keys and fetch workers for those instances in one query
		const workers = await database.table("instances_workers").orderBy("index", "asc");

		const workersByInstance: Record<string, any[]> = {};
		for (const worker of workers) {
			if (!workersByInstance[worker.instance_key]) workersByInstance[worker.instance_key] = [];
			workersByInstance[worker.instance_key].push(worker);
		}

		// Parse instance.system JSON and attach workers array to each instance
		const result = instances.map((instance) => {
			return {
				...instance,
				specs: instance.specs ? JSON.parse(instance.specs) : "{}",
				workers: workersByInstance[instance.key] || []
			};
		});

		return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" }, data: sanitizeData(result) });
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to fetch instances!", { error });
		res.status(500).json({
			metadata: {
				...responseMetadata,
				status: "ERROR",
				error: { code: "INTERNAL_ERROR", message: error.message || "Failed to fetch instances!" }
			}
		});
	}
});

// Worker status endpoint - read persisted worker metadata and enrich with in-memory process state
app.get("/instances/workers", authMiddleware(), async (req, res) => {
	try {
		const worker_key = (req.query.worker_key || req.body.worker_key || "").trim();

		// If worker_key provided, fetch only that worker and return as object (not array)
		if (worker_key) {
			const worker = await database.table("instances_workers").where("key", worker_key).first();

			if (!worker) {
				return res.status(404).json({
					metadata: { ...responseMetadata, status: "ERROR", error: { code: "NOT_FOUND", message: "Worker not found!" } }
				});
			}

			return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" }, data: sanitizeData(worker) });
		}

		const instance_key = (req.query.instance_key || req.body.instance_key || "").trim();

		const query = database.table("instances_workers");
		if (instance_key) query.where("instance_key", instance_key);
		const workers = await query.orderBy("index", "asc");

		return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" }, data: sanitizeData(workers) });
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to fetch workers!", { error });
		return res.status(500).json({
			metadata: {
				...responseMetadata,
				status: "ERROR",
				error: { code: "INTERNAL_ERROR", message: error.message || "Failed to fetch workers!" }
			}
		});
	}
});

app.get("/jobs", authMiddleware(), async (req, res) => {
	try {
		const job_key = (req.query.job_key || req.body.job_key || "").trim();

		// If job_key provided, fetch only that job and return as object (not array)
		if (job_key) {
			const job = await database.table("jobs").where("key", job_key).first();

			if (!job) {
				return res
					.status(404)
					.json({ metadata: { ...responseMetadata, status: "ERROR", error: { code: "NOT_FOUND", message: "Job not found!" } } });
			}

			return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" }, data: sanitizeData(job) });
		}

		const defaultLimit = 25;
		const rawLimit = req.query.limit;
		const rawPage = req.query.page;
		const instance_key = (req.query.instance_key || req.body.instance_key || "").trim();
		const worker_key = (req.query.worker_key || req.body.worker_key || "").trim();
		const status = (req.query.status || req.body.status || "").trim();
		const q = req.query.q ? String(req.query.q).trim() : "";

		let limit = rawLimit !== undefined ? parseInt(String(rawLimit), 10) : defaultLimit;
		if (isNaN(limit) || limit < 1) limit = defaultLimit;

		let page = rawPage !== undefined ? parseInt(String(rawPage), 10) : 1;
		if (isNaN(page) || page < 1) page = 1;

		const offset = (page - 1) * limit;

		// Build query with Knex
		let query = database.table("jobs");

		if (instance_key) query = query.where("instance_key", instance_key);
		if (worker_key) query = query.where("worker_key", worker_key);
		if (status) query = query.where("status", status);

		if (q) {
			const searchPattern = `%${q}%`;
			query = query.where(function () {
				this.where("key", "like", searchPattern)
					.orWhere("instance_key", "like", searchPattern)
					.orWhere("worker_key", "like", searchPattern)
					.orWhere("input", "like", searchPattern)
					.orWhere("outputs", "like", searchPattern)
					.orWhere("destination", "like", searchPattern)
					.orWhere("notification", "like", searchPattern)
					.orWhere("metadata", "like", searchPattern)
					.orWhere("outcome", "like", searchPattern)
					.orWhere("status", "like", searchPattern);
			});
		}

		// Get total count for pagination metadata
		const totalResult = await query.clone().count("* as total").first();
		const total = (totalResult as any).total;

		// Get paginated data
		const jobs = await query.orderBy("created_at", "desc").limit(limit).offset(offset);

		// Calculate pagination metadata
		const totalPages = Math.ceil(total / limit);
		const hasMore = page < totalPages;
		const nextPage = hasMore ? page + 1 : null;
		const prevPage = page > 1 ? page - 1 : null;

		return res.json({
			metadata: { ...responseMetadata, status: "SUCCESSFUL" },
			data: sanitizeData(jobs),
			pagination: {
				limit,
				page,
				total,
				total_pages: totalPages,
				has_more: hasMore,
				next_page: nextPage,
				prev_page: prevPage
			}
		});
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to fetch jobs!", { error });
		return res.status(500).json({
			metadata: {
				...responseMetadata,
				status: "ERROR",
				error: { code: "INTERNAL_ERROR", message: error.message || "Failed to fetch jobs!" }
			}
		});
	}
});

app.put("/jobs", authMiddleware(), async (req: Request, res: Response) => {
	const body = req.body as JobRequest;

	if (!body || !body.input || !Array.isArray(body.outputs) || body.outputs.length === 0) {
		return res.status(400).json({
			metadata: {
				...responseMetadata,
				status: "ERROR",
				error: { code: "REQUEST_INVALID", message: "Require input and outputs[]!" }
			}
		});
	}

	try {
		const job_key = uukey();
		const priority = body.priority ?? 1000; // Default priority is 1000
		const now = getNow();

		// OUTPUTs: VALIDATE
		const outputs = [];
		for (let index = 0; index < body.outputs.length; index++) {
			const specs: OutputSpecs = body.outputs[index];

			outputs.push({
				key: uukey(),
				job_key,
				index,
				specs,
				outcome: null,
				status: "PENDING",
				updated_at: now,
				created_at: now
			});
		}

		if (outputs.length === 0) {
			return res.status(400).json({
				metadata: {
					...responseMetadata,
					status: "ERROR",
					error: { code: "REQUEST_INVALID", message: "At least one output specification is required!" }
				}
			});
		}

		// NOTIFICATION: VALIDATE
		if (body.notification) {
			if (body.notification.notify_on && Array.isArray(body.notification.notify_on)) {
				const allowedNotifyOns = config.jobs.notifications.notify_on_alloweds.split(",").map((e) => e.trim());

				body.notification.notify_on = body.notification.notify_on.filter((status: string) => allowedNotifyOns.includes(status));
			}
		}

		const job: JobRow = {
			key: job_key,
			priority: priority,
			input: body.input ? body.input : null,
			outputs: outputs ? outputs : null,
			destination: body.destination ? body.destination : null,
			notification: body.notification ? body.notification : null,
			metadata: body.metadata ? body.metadata : null,
			status: config.jobs.enqueue_on_receive ? "QUEUED" : "PENDING", // "RECEIVED"
			updated_at: now,
			created_at: now,
			locked_by: null,
			try_max: body.try_max ? body.try_max : config.jobs.try_count || 3,
			try_count: 0,
			retry_in: body.retry_in ? body.retry_in : config.jobs.retry_in || 60 * 1000,
			retry_at: null
		};

		if ((job.try_max || 0) < config.jobs.try_min) job.try_max = config.jobs.try_min;
		if ((job.try_max || 0) > config.jobs.try_max) job.try_max = config.jobs.try_max;

		if ((job.retry_in || 0) < config.jobs.retry_in_min) job.retry_in = config.jobs.retry_in_min;
		if ((job.retry_in || 0) > config.jobs.retry_in_max) job.retry_in = config.jobs.retry_in_max;

		await database
			.table("jobs")
			.insert({
				...job,
				input: JSON.stringify(job.input),
				outputs: JSON.stringify(job.outputs),
				destination: job.destination ? JSON.stringify(job.destination) : null,
				notification: job.notification ? JSON.stringify(job.notification) : null,
				metadata: job.metadata ? JSON.stringify(job.metadata) : null
			})
			.then(async (result) => {
				await createJobNotification(job, "RECEIVED");

				await stats.update({
					jobs_recieved_count: 1,
					inputs_recieved_count: 1,
					outputs_requested_count: job.outputs?.length || 0
					// notifications_requested_count: job.notification ? 1 : 0
				});

				await logger.insert("INFO", "Job request received!", { job_key });
				// await logger.insert("INFO", "Job successfully created!", { job_key });

				if (job.status === "QUEUED") {
					// JOB: QUEUE: INSERT
					await database
						.table("jobs_queue")
						.insert({ key: job.key, priority: job.priority, created_at: job.created_at })
						.then(async (result) => {
							// await stats.update({ jobs_queued_count: 1 });
							await logger.insert("INFO", "Job successfully queued!", { job_key });
						})
						.catch(async (error) => {
							// JOB: UPDATE: PENDING
							job.status = "PENDING";
							await database.table("jobs").where("key", job_key).update({ status: job.status, updated_at: getNow() });
							await logger.insert("ERROR", "Enqueuing job failed!", { job_key, error });
						});
				}

				await createJobNotification(job, job.status as string);
			})
			.catch(async (error) => {
				await createJobNotification(job, "FAILED");
				throw error;
			});

		return res.status(202).json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" }, data: sanitizeData(job) });
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Create job failed!", { error });
		return res.status(500).json({
			metadata: { ...responseMetadata, status: "ERROR", error: { code: "INTERNAL_ERROR", message: "Job creation failed!" } }
		});
	}
});

app.post("/jobs/retry", authMiddleware(), async (req: Request, res: Response) => {
	const job_key = (req.query.job_key || req.body.job_key || "").trim();
	const output_key = (req.query.output_key || req.body.output_key || "").trim();

	if (!job_key) {
		return res
			.status(400)
			.json({ metadata: { ...responseMetadata, status: "ERROR", error: { code: "KEY_REQUIRED", message: "Job key required!" } } });
	}

	const job = await database.table("jobs").where("key", job_key).first();

	if (!job) {
		return res
			.status(404)
			.json({ metadata: { ...responseMetadata, status: "ERROR", error: { code: "NOT_FOUND", message: "Job not found!" } } });
	}

	if (!["CANCELLED", "DELETED", "FAILED", "TIMEOUT"].includes(job.status)) {
		return res.status(405).json({
			metadata: { ...responseMetadata, status: "ERROR", error: { code: "NOT_ALLOWED", message: "Job cannot be reprocessed!" } }
		});
	}

	let jobOutputsUpdatedCount = 0;
	job.outputs = job.outputs ? JSON.parse(job.outputs as string) : null;

	if (job.outputs) {
		for (let index = 0; index < job.outputs.length; index++) {
			if ((!output_key || output_key == job.outputs[index].key) && !["COMPLETED"].includes(job.outputs[index].status)) {
				job.outputs[index].status = "PENDING";
				jobOutputsUpdatedCount++;
			}
		}
	}

	if (jobOutputsUpdatedCount <= 0) {
		return res.status(405).json({
			metadata: { ...responseMetadata, status: "ERROR", error: { code: "NOT_ALLOWED", message: "Job cannot be reprocessed!" } }
		});
	}

	await database
		.table("jobs")
		.where("key", job_key)
		.update({
			outputs: job.outputs ? JSON.stringify(job.outputs) : null,
			status: "PENDING", // RETRYING
			try_count: 0
			// retry_at: getNow()
		});

	await logger.insert("INFO", "Retrying job!", { job_key, output_key });

	return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" } });
});

app.delete("/jobs", authMiddleware(), async (req: Request, res: Response) => {
	const job_key = (req.query.job_key || req.body.job_key || "").trim();

	if (!job_key) {
		return res
			.status(400)
			.json({ metadata: { ...responseMetadata, status: "ERROR", error: { code: "KEY_REQUIRED", message: "Job key required!" } } });
	}

	const job = await database.table("jobs").where("key", job_key).select("key", "status").first();

	if (!job) {
		return res
			.status(404)
			.json({ metadata: { ...responseMetadata, status: "ERROR", error: { code: "NOT_FOUND", message: "Job not found!" } } });
	}

	if (["DELETED"].includes(job.status)) {
		await database.table("jobs").where("key", job_key).delete();
		await database.table("jobs_queue").where("key", job_key).delete();
		await database.table("jobs_notifications").where("job_key", job_key).delete();
		await database.table("jobs_notifications_queue").where("job_key", job_key).delete();

		try {
			await storage.delete(`/jobs/${job_key}/`);
		} catch (error: Error | any) {}

		await logger.insert("INFO", "Job permanently deleted!", { job_key });
		return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" } });
	}

	if (!["RECEIVED", "PENDING", "RETRYING"].includes(job.status)) {
		return res.status(405).json({
			metadata: { ...responseMetadata, status: "ERROR", error: { code: "NOT_ALLOWED", message: "Job cannot be soft deleted!" } }
		});
	}

	await database.table("jobs").where("key", job_key).update({ status: "DELETED" });
	await logger.insert("INFO", "Job soft deleted!", { job_key });

	return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" } });
});

app.delete("/jobs/all", authMiddleware(), async (req, res) => {
	try {
		const jobs = await database.table("jobs").select("key");

		const jobsKeys = jobs.map((r: any) => r.key);

		if (jobsKeys.length > 0) {
			// Delete job folders/objects via unified storage facade
			for (const job_key of jobsKeys) {
				try {
					await storage.delete(`/jobs/${job_key}/`);
				} catch (error: Error | any) {}
			}

			await database.table("jobs").whereIn("key", jobsKeys).delete();
			await database.table("jobs_queue").whereIn("key", jobsKeys).delete();
			await database.table("jobs_notifications").whereIn("job_key", jobsKeys).delete();
			await database.table("jobs_notifications_queue").whereIn("job_key", jobsKeys).delete();

			await logger.insert("INFO", "All jobs permanently deleted!", { count: jobsKeys.length });
		}

		return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" }, message: "All jobs permanently deleted!" });
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to delete all jobs!", { error });

		return res.status(500).json({
			metadata: {
				...responseMetadata,
				status: "ERROR",
				error: { code: "INTERNAL_ERROR", message: error.message || "Failed to delete all jobs!" }
			}
		});
	}
});

app.get("/jobs/preview", async (req: Request, res: Response) => {
	const job_key = (req.query.job_key || req.body.job_key || "").trim();

	const serveFallbackImage = () => {
		res.setHeader("Content-Type", "image/webp");
		res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
		res.sendFile(path.resolve(path.join(".", "assets", "no-preview.webp")));
	};

	try {
		if (job_key) {
			// Check if job exists
			const job = await database.table("jobs").where("key", job_key).first();

			if (!job) {
				return res
					.status(404)
					.json({ metadata: { ...responseMetadata, status: "ERROR", error: { code: "NOT_FOUND", message: "Job not found!" } } });
			}

			try {
				// Try to read via storage facade; if missing, fall back to placeholder
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
});

app.get("/jobs/notifications", authMiddleware(), async (req, res) => {
	try {
		const notification_key = (req.query.notification_key || req.body.notification_key || "").trim();

		// If notification_key provided, fetch only that notification and return as object (not array)
		if (notification_key) {
			const notification = await database.table("jobs_notifications").where("key", notification_key).first();

			if (!notification) {
				return res.status(404).json({
					metadata: { ...responseMetadata, status: "ERROR", error: { code: "NOT_FOUND", message: "Notification not found!" } }
				});
			}

			return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" }, data: sanitizeData(notification) });
		}

		const defaultLimit = 25;
		const rawLimit = req.query.limit;
		const rawPage = req.query.page;
		const instance_key = (req.query.instance_key || req.body.instance_key || "").trim();
		const worker_key = (req.query.worker_key || req.body.worker_key || "").trim();
		const job_key = (req.query.job_key || req.body.job_key || "").trim();
		const status = (req.query.status || req.body.status || "").trim();
		const q = req.query.q ? String(req.query.q).trim() : "";

		let limit = rawLimit !== undefined ? parseInt(String(rawLimit), 10) : defaultLimit;
		if (isNaN(limit) || limit < 1) limit = defaultLimit;

		let page = rawPage !== undefined ? parseInt(String(rawPage), 10) : 1;
		if (isNaN(page) || page < 1) page = 1;

		const offset = (page - 1) * limit;

		// Build query with Knex
		let query = database.table("jobs_notifications");

		if (instance_key) query = query.where("instance_key", instance_key);
		if (worker_key) query = query.where("worker_key", worker_key);
		if (job_key) query = query.where("job_key", job_key);
		if (status) query = query.where("status", status);

		if (q) {
			const searchPattern = `%${q}%`;
			query = query.where(function () {
				this.where("key", "like", searchPattern)
					.orWhere("job_key", "like", searchPattern)
					.orWhere("instance_key", "like", searchPattern)
					.orWhere("worker_key", "like", searchPattern)
					.orWhere("specs", "like", searchPattern)
					.orWhere("payload", "like", searchPattern)
					.orWhere("outcome", "like", searchPattern)
					.orWhere("status", "like", searchPattern);
			});
		}

		// Get total count for pagination metadata
		const totalResult = await query.clone().count("* as total").first();
		const total = (totalResult as any).total;

		// Get paginated data
		const notifications = await query.orderBy("created_at", "desc").limit(limit).offset(offset);

		// Calculate pagination metadata
		const totalPages = Math.ceil(total / limit);
		const hasMore = page < totalPages;
		const nextPage = hasMore ? page + 1 : null;
		const prevPage = page > 1 ? page - 1 : null;

		return res.json({
			metadata: { ...responseMetadata, status: "SUCCESSFUL" },
			data: sanitizeData(notifications),
			pagination: {
				limit,
				page,
				total,
				total_pages: totalPages,
				has_more: hasMore,
				next_page: nextPage,
				prev_page: prevPage
			}
		});
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to fetch job notifications!", { error });
		return res.status(500).json({
			metadata: {
				...responseMetadata,
				status: "ERROR",
				error: { code: "INTERNAL_ERROR", message: error.message || "Failed to fetch job notifications!" }
			}
		});
	}
});

app.post("/jobs/notifications/retry", authMiddleware(), async (req, res) => {
	try {
		const notification_key = (req.query.notification_key || req.body.notification_key || "").trim();

		if (!notification_key) {
			return res.status(400).json({
				metadata: { ...responseMetadata, status: "ERROR", error: { code: "KEY_REQUIRED", message: "Notification key required!" } }
			});
		}

		const notification = await database.table("jobs_notifications").where("key", notification_key).first();

		if (!notification) {
			return res.status(404).json({
				metadata: { ...responseMetadata, status: "ERROR", error: { code: "NOT_FOUND", message: "Notification not found!" } }
			});
		}

		// Reset notification status to PENDING for retry
		await database.table("jobs_notifications").where("key", notification_key).update({
			status: "PENDING",
			retry_at: getNow(),
			updated_at: getNow()
		});

		return res.json({ metadata: { ...responseMetadata, status: "SUCCESSFUL" }, message: "Notification successfully rescheduled!" });
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to fetch job notifications!", { error });
		return res.status(500).json({
			metadata: {
				...responseMetadata,
				status: "ERROR",
				error: { code: "INTERNAL_ERROR", message: error.message || "Failed to fetch job notifications!" }
			}
		});
	}
});

app.get("/test", async (req, res) => {
	const rows = await database.table("jobs_queue");
	return res.json({ ...rows });
});

/*
const frontendPath = path.join(__dirname, '../../frontend-build');
app.use(express.static(frontendPath));
app.get("/*", (req: Request, res: Response) => res.sendFile(path.join(frontendPath, "index.html")));
*/

app.use((error: any, req: any, res: any, _next: any) => {
	logger.insert("ERROR", "An error occurred on API service!", { error });
	return res.status(500).json({
		metadata: {
			...responseMetadata,
			status: "ERROR",
			error: { code: "INTERNAL_ERROR", message: "An error occurred on API service!" }
		}
	});
});

logger.insert("INFO", "Starting API service on :port...", { instance_key, port: config.api.node_port });

(async () => {
	logger.setMetadata({ instance_key });
	await storage.config(config.storage);
	database.config(config.database);
	await database.verifySchemaExists();

	app.listen(config.api.node_port, () => {
		logger.insert("INFO", "API service started successfully on :port!", { port: config.api.node_port });
	}).on("error", (error: Error | any) => {
		logger.insert("ERROR", "Failed to start API service!", { error });
	});
})();
