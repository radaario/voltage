import { config as appConfig } from "@voltage/core/config";
import { HTTPS_TYPES, STORAGE_FTP_TYPES, STORAGE_S3_LIKE_TYPES } from "@voltage/core/constants";
import type {
	JobRequest,
	JobConfig,
	JobInput,
	JobDestination,
	JobNotification,
	JobRow,
	JobOutputRequest,
	JobOutputRow
} from "@voltage/core/types";
import { database, storage, logger, stats } from "@voltage/utils";
import { uukey, getNow, getDate } from "@voltage/utils";
import { createJobNotification } from "@voltage/runtime/worker/notifier";

import { Knex } from "knex";
import { PaginationParams } from "@/types/index.js";

export const getJob = async (job_key: string) => {
	const job = await database.table("jobs").where("key", job_key).first();

	if (!job) {
		throw new Error("NOT_FOUND");
	}

	const jobOutputs = await database.table("jobs_outputs").where("job_key", job_key).orderBy("index", "asc");

	return { ...job, outputs: jobOutputs };
};

export const getJobs = async (
	pagination: PaginationParams,
	filters: {
		status?: string;
		instance_key?: string;
		worker_key?: string;
		q?: string;
	}
) => {
	let query = database.table("jobs");

	if (filters.status) query = query.where("status", filters.status);
	if (filters.instance_key) query = query.where("instance_key", filters.instance_key);
	if (filters.worker_key) query = query.where("worker_key", filters.worker_key);

	if (filters.q) {
		const searchPattern = `%${filters.q}%`;
		query = query.where((builder: Knex.QueryBuilder) => {
			/* ! */
			builder
				.where("key", "like", searchPattern)
				.orWhere("input", "like", searchPattern)
				.orWhere("destination", "like", searchPattern)
				.orWhere("notification", "like", searchPattern)
				.orWhere("metadata", "like", searchPattern)
				.orWhere("outcome", "like", searchPattern)
				.orWhere("status", "like", searchPattern)
				.orWhere("instance_key", "like", searchPattern)
				.orWhere("worker_key", "like", searchPattern);
		});
	}

	const totalResult = await query.clone().count("* as total").first();
	const total = (totalResult as any).total;

	const jobs = await query.orderBy("created_at", "desc").limit(pagination.limit).offset(pagination.offset);

	const sanitizedJobs: any = [];

	for (const job of jobs) {
		const jobOutputs = await database.table("jobs_outputs").where("job_key", job.key).orderBy("index", "asc");

		sanitizedJobs.push({
			...job,
			outputs: jobOutputs
		});
	}

	return { data: sanitizedJobs, total };
};

export const createJob = async (body: JobRequest) => {
	if (!body || !body.input || !Array.isArray(body.outputs) || body.outputs.length === 0) {
		throw new Error("REQUEST_INVALID");
	}

	const now = getNow();

	// Validate job
	const jobKey = uukey();
	const jobPriority = body.priority ?? 1000;

	const jobConfig: JobConfig = body.config || {};
	const jobInput: JobInput = body.input || {};
	const jobDestination: JobDestination | null = body.destination || null;
	const jobNotification: JobNotification | null = body.notification || null;
	const jobMetadata: any = body.metadata || null;

	const jobStatus = appConfig.jobs.enqueue_on_receive ? "QUEUED" : "PENDING";

	// Validate job outputs
	const jobOutputs: Array<JobOutputRow> = [];

	for (let jobOutputIndex = 0; jobOutputIndex < body.outputs.length; jobOutputIndex++) {
		const jobOutput: JobOutputRequest = body.outputs[jobOutputIndex];

		const jobOutputPriority = jobOutput.priority;
		const jobOutputType = jobOutput.type;
		const jobOutputMetadata = {
			name: jobOutput.name || undefined,
			metadata: jobOutput.metadata || undefined
		};

		const jobOutputConfig = {
			...jobOutput,
			priority: undefined,
			type: undefined,
			name: undefined,
			url: undefined,
			path: undefined,
			destination: undefined,
			acl: undefined,
			expires_in: undefined,
			cache_control: undefined,
			try: undefined,
			retry_in: undefined
		};

		if (!jobOutputConfig.preset) {
			jobOutputConfig.preset = jobConfig.ffmpeg_preset || appConfig.utils.ffmpeg.preset || "DEFAULT";
		}

		if (jobOutputConfig.quality === undefined && jobConfig.ffmpeg_quality) {
			jobOutputConfig.quality = jobConfig.ffmpeg_quality || null;
		}

		if (["SUBTITLE"].includes(jobOutputType)) {
			if (!jobOutputConfig.whisper_model) {
				jobOutputConfig.whisper_model = jobConfig.whisper_model || appConfig.utils.whisper.model || "BASE";
			}

			if (jobOutputConfig.whisper_with_cuda === undefined) {
				jobOutputConfig.whisper_with_cuda = jobConfig.whisper_with_cuda || appConfig.utils.whisper.with_cuda || false;
			}
		}

		// Build destination based on type
		let jobOutputDestination: any = {
			...jobDestination,
			...jobOutput.destination
		};

		if (jobOutput.destination?.type && jobOutput.destination.type != jobDestination?.type) {
			jobOutputDestination = {
				...jobOutput.destination
			};
		}

		if (HTTPS_TYPES.includes(jobOutputDestination.type)) {
			// HTTP/HTTPS: only include url
			jobOutputDestination = {
				...jobOutputDestination,
				url: (jobOutput.destination as any)?.url || jobOutput.url || undefined
			};
		} else if (STORAGE_FTP_TYPES.includes(jobOutputDestination.type)) {
			// FTP/SFTP: only include path
			jobOutputDestination = {
				...jobOutputDestination,
				path: (jobOutput.destination as any)?.path || jobOutput.path || undefined
			};
		} else if (STORAGE_S3_LIKE_TYPES.includes(jobOutputDestination.type)) {
			// S3_LIKE: include path, acl, expires_in, cache_control
			jobOutputDestination = {
				...jobOutputDestination,
				path: (jobOutput.destination as any)?.path || jobOutput.path || undefined,
				acl: (jobOutput.destination as any)?.acl || jobOutput.acl || (jobDestination as any)?.acl || undefined,
				expires_in: (jobOutput.destination as any)?.expires_in || jobOutput.expires_in || undefined,
				cache_control: (jobOutput.destination as any)?.cache_control || jobOutput.cache_control || undefined
			};
		}

		jobOutputs.push({
			key: uukey(),
			job_key: jobKey,
			index: jobOutputIndex,
			priority: jobOutputPriority || jobPriority || appConfig.jobs.priority || 1000,
			type: jobOutputType,
			config: jobOutputConfig,
			destination: jobOutputDestination || jobDestination || null,
			metadata: jobOutputMetadata || null,
			outcome: null,
			status: jobStatus,
			started_at: null,
			processed_at: null,
			uploaded_at: null,
			completed_at: null,
			updated_at: now,
			created_at: now,
			try_max: jobOutput.try || body?.try || appConfig?.jobs?.try || 3,
			try_count: appConfig.jobs.enqueue_on_receive ? 1 : 0,
			retry_in: jobOutput.retry_in || body?.retry_in || appConfig?.jobs?.retry_in || 60 * 1000,
			retry_at: null,
			locked_by: null,
			instance_key: null,
			worker_key: null
		});
	}

	if (jobOutputs.length === 0) {
		throw new Error("OUTPUT_REQUIRED");
	}

	// Validate job notification
	if (jobNotification) {
		if (jobNotification.notify_on && Array.isArray(jobNotification.notify_on)) {
			const allowedNotifyOns = appConfig.jobs.notifications.notify_on_alloweds.split(",").map((e) => e.trim());
			jobNotification.notify_on = jobNotification.notify_on.filter((status: string) => allowedNotifyOns.includes(status));
		}
	}

	const job: JobRow = {
		key: jobKey,
		priority: jobPriority,
		config: jobConfig,
		input: jobInput,
		destination: jobDestination,
		notification: jobNotification,
		metadata: jobMetadata,
		outcome: null,
		status: jobStatus,
		progress: 0,
		started_at: null,
		downloaded_at: null,
		analyzed_at: null,
		processed_at: null,
		uploaded_at: null,
		completed_at: null,
		updated_at: now,
		created_at: now,
		try_max: body.try ? body.try : appConfig.jobs.try || 3,
		try_count: appConfig.jobs.enqueue_on_receive ? 1 : 0,
		retry_in: body.retry_in ? body.retry_in : appConfig.jobs.retry_in || 60 * 1000,
		retry_at: null,
		locked_by: null,
		instance_key: null,
		worker_key: null
	};

	await database
		.table("jobs")
		.insert({
			...job,
			config: job.config ? JSON.stringify(job.config) : null,
			input: JSON.stringify(job.input),
			destination: job.destination ? JSON.stringify(job.destination) : null,
			notification: job.notification ? JSON.stringify(job.notification) : null,
			metadata: job.metadata ? JSON.stringify(job.metadata) : null
		})
		.then(async () => {
			await database
				.table("jobs_outputs")
				.insert(
					jobOutputs.map((jobOutput) => ({
						...jobOutput,
						config: jobOutput.config ? JSON.stringify(jobOutput.config) : null,
						destination: jobOutput.destination ? JSON.stringify(jobOutput.destination) : null,
						// outcome: jobOutput.outcome ? JSON.stringify(jobOutput.outcome) : null,
						status: appConfig.jobs.enqueue_on_receive ? "QUEUED" : "PENDING",
						updated_at: now,
						created_at: now
					}))
				)
				.then(async () => {
					await createJobNotification(job, "RECEIVED");

					await stats.update({
						jobs_recieved_count: 1,
						inputs_recieved_count: 1,
						outputs_requested_count: jobOutputs.length || 0
					});

					await logger.insert("API", "INFO", "Job request received!", { job_key: jobKey });

					if (job.status === "QUEUED") {
						await database
							.table("jobs_queue")
							.insert({ key: job.key, priority: job.priority, created_at: job.created_at })
							.then(async () => {
								await logger.insert("API", "INFO", "Received job successfully queued!", { job_key: jobKey });
							})
							.catch(async (error: Error | any) => {
								job.status = "PENDING";

								await database
									.table("jobs")
									.where("key", jobKey)
									.update({
										outcome: JSON.stringify({ message: "Enqueuing received job failed!" }),
										status: job.status,
										updated_at: getNow()
									});

								await logger.insert("API", "ERROR", "Enqueuing received job failed!", { job_key: jobKey, ...error });
							});
					}

					await createJobNotification(job, job.status as string);
				})
				.catch(async (error: Error | any) => {
					await createJobNotification(job, "FAILED");
					throw error;
				});
		})
		.catch(async (error: Error | any) => {
			await createJobNotification(job, "FAILED");
			throw error;
		});

	return { ...job, outputs: jobOutputs };
};

export const retryJob = async (job_key: string, output_key?: string) => {
	if (!job_key) {
		throw new Error("KEY_REQUIRED");
	}

	const job = await database.table("jobs").where("key", job_key).first();

	if (!job) {
		throw new Error("NOT_FOUND");
	}

	if (!["QUEUED", "COMPLETED", "CANCELLED", "DELETED", "FAILED", "TIMEOUT"].includes(job.status)) {
		throw new Error("NOT_ALLOWED");
	}

	const now = getNow();

	const jobOutputs = await database.table("jobs_outputs").where("job_key", job_key).select("key", "status");
	let updatedJobOutputsKeys: string[] = [];

	for (const jobOutput of jobOutputs) {
		if (!output_key || output_key === jobOutput.key) {
			//  && !["COMPLETED"].includes(jobOutput.status)
			updatedJobOutputsKeys.push(jobOutput.key);
		}
	}

	if (updatedJobOutputsKeys.length <= 0) {
		throw new Error("NOT_ALLOWED");
	}

	await database.table("jobs_outputs").whereIn("key", updatedJobOutputsKeys).update({
		outcome: null,
		status: "PENDING",
		updated_at: now,
		try_count: 0
	});

	await database.table("jobs").where("key", job_key).update({
		outcome: null,
		status: "PENDING",
		updated_at: now,
		try_count: 0
	});

	await logger.insert("API", "INFO", "Retrying job!", { job_key, output_key });

	return { message: "Job retry initiated!" };
};

export const deleteJobs = async (params: {
	all?: boolean;
	job_key?: string;
	hard_delete?: boolean;
	since_at?: string;
	until_at?: string;
}) => {
	let query = database.table("jobs");

	if (params.all) {
		// Do nothing, select all
	} else if (params.job_key) {
		if (!params.job_key) {
			throw new Error("KEY_REQUIRED");
		}
		query = query.where("key", params.job_key);
	}

	if (params.since_at) {
		const sinceDate = getDate(params.since_at, "YYYY-MM-DD");
		query = query.where("created_at", ">=", sinceDate);
	}

	if (params.until_at) {
		const untilDate = getDate(params.until_at, "YYYY-MM-DD");
		query = query.where("created_at", "<=", untilDate);
	}

	const jobs = await query.select("key", "status");
	const jobsKeysToSoftDelete = [];
	const jobsKeysToHardDelete = [];

	for (const job of jobs) {
		if (params.hard_delete || ["DELETED"].includes(job.status)) {
			jobsKeysToHardDelete.push(job.key);
		} else {
			jobsKeysToSoftDelete.push(job.key);
		}
	}

	if (jobsKeysToSoftDelete.length > 0) {
		await database.table("jobs").whereIn("key", jobsKeysToSoftDelete).update({ status: "DELETED" });
		await database.table("jobs_outputs").whereIn("job_key", jobsKeysToSoftDelete).update({ status: "DELETED" });
	}

	if (jobsKeysToHardDelete.length > 0) {
		await storage.config(appConfig.storage);

		// Delete job folders/objects via unified storage facade
		for (const job_key of jobsKeysToHardDelete) {
			try {
				await storage.delete(`/jobs/${job_key}`);
			} catch (error: Error | any) {}
		}

		await database.table("jobs").whereIn("key", jobsKeysToHardDelete).delete();
		await database.table("jobs_queue").whereIn("key", jobsKeysToHardDelete).delete();
		await database.table("jobs_outputs").whereIn("job_key", jobsKeysToHardDelete).delete();
		await database.table("jobs_notifications").whereIn("job_key", jobsKeysToHardDelete).delete();
		await database.table("jobs_notifications_queue").whereIn("job_key", jobsKeysToHardDelete).delete();
		await database.table("logs").whereIn("job_key", jobsKeysToHardDelete).delete();
	}

	if (params.all) {
		await logger.insert("API", "WARNING", "All jobs permanently deleted!");
		return { message: "All jobs permanently deleted!" };
	}

	if (params.job_key) {
		await logger.insert("API", "WARNING", "Job permanently deleted!", { ...params });
		return { message: "Job permanently deleted!" };
	}

	await logger.insert("API", "WARNING", "Some jobs permanently deleted!", { ...params, count: jobsKeysToHardDelete.length });
	return { message: "Some jobs permanently deleted!" };
};

export const getOutput = async (output_key: string) => {
	const output = await database.table("jobs_outputs").where("key", output_key).first();

	if (!output) {
		throw new Error("NOT_FOUND");
	}

	return output;
};

export const getOutputs = async (
	pagination: PaginationParams,
	filters: {
		job_key?: string;
		status?: string;
		instance_key?: string;
		worker_key?: string;
		q?: string;
	}
) => {
	let query = database.table("jobs_outputs");

	if (filters.job_key) query = query.where("job_key", filters.job_key);
	if (filters.status) query = query.where("status", filters.status);
	if (filters.instance_key) query = query.where("instance_key", filters.instance_key);
	if (filters.worker_key) query = query.where("worker_key", filters.worker_key);

	if (filters.q) {
		const searchPattern = `%${filters.q}%`;
		query = query.where((builder: Knex.QueryBuilder) => {
			/* ! */
			builder
				.where("key", "like", searchPattern)
				.orWhere("job_key", "like", searchPattern)
				.orWhere("config", "like", searchPattern)
				.orWhere("outcome", "like", searchPattern)
				.orWhere("status", "like", searchPattern)
				.orWhere("instance_key", "like", searchPattern)
				.orWhere("worker_key", "like", searchPattern);
		});
	}

	if (filters.job_key) {
		const outputs = await query.orderBy("index", "asc");
		return outputs;
	}

	const totalResult = await query.clone().count("* as total").first();
	const total = (totalResult as any).total;

	const outputs = await query.orderBy("created_at", "desc").orderBy("index", "asc").limit(pagination.limit).offset(pagination.offset);

	return { data: outputs, total };
};

export const getNotification = async (notification_key: string) => {
	const notification = await database.table("jobs_notifications").where("key", notification_key).first();

	if (!notification) {
		throw new Error("NOT_FOUND");
	}

	return notification;
};

export const getNotifications = async (
	pagination: PaginationParams,
	filters: {
		job_key?: string;
		status?: string;
		instance_key?: string;
		worker_key?: string;
		q?: string;
	}
) => {
	let query = database.table("jobs_notifications");

	if (filters.job_key) query = query.where("job_key", filters.job_key);
	if (filters.status) query = query.where("status", filters.status);
	if (filters.instance_key) query = query.where("instance_key", filters.instance_key);
	if (filters.worker_key) query = query.where("worker_key", filters.worker_key);

	if (filters.q) {
		const searchPattern = `%${filters.q}%`;
		query = query.where((builder: Knex.QueryBuilder) => {
			/* ! */
			builder
				.where("key", "like", searchPattern)
				.orWhere("job_key", "like", searchPattern)
				.orWhere("config", "like", searchPattern)
				.orWhere("payload", "like", searchPattern)
				.orWhere("outcome", "like", searchPattern)
				.orWhere("status", "like", searchPattern)
				.orWhere("instance_key", "like", searchPattern)
				.orWhere("worker_key", "like", searchPattern);
		});
	}

	const totalResult = await query.clone().count("* as total").first();
	const total = (totalResult as any).total;

	const data = await query.orderBy("created_at", "desc").limit(pagination.limit).offset(pagination.offset);

	return { data, total };
};

export const retryNotification = async (notification_key: string) => {
	if (!notification_key) {
		throw new Error("KEY_REQUIRED");
	}

	const notification = await database.table("jobs_notifications").where("key", notification_key).first();

	if (!notification) {
		throw new Error("NOT_FOUND");
	}

	const now = getNow();

	notification.status = "PENDING";
	notification.updated_at = now;
	notification.try_count = 0;
	notification.retry_at = now;

	await database
		.table("jobs_notifications_queue")
		.where("key", notification_key)
		.insert({ ...notification })
		.then(async () => {
			await database
				.table("jobs_notifications")
				.where("key", notification_key)
				.update({ ...notification });
		});

	return { message: "Notification successfully rescheduled!" };
};

export const deleteNotifications = async (params: { all?: boolean; notification_key?: string; since_at?: string; until_at?: string }) => {
	if (params.all) {
		await database.table("jobs_notifications").delete();
		await logger.insert("API", "WARNING", "All job notifications successfully deleted!");
		return { message: "All job notifications successfully deleted!" };
	}

	if (params.notification_key) {
		await database.table("jobs_notifications").where("key", params.notification_key).delete();
		return { message: "job notification successfully deleted!" };
	}

	let query = database.table("jobs_notifications");

	if (params.since_at) {
		const sinceDate = getDate(params.since_at, "YYYY-MM-DD");
		query = query.where("created_at", ">=", sinceDate);
	}

	if (params.until_at) {
		const untilDate = getDate(params.until_at, "YYYY-MM-DD");
		query = query.where("created_at", "<=", untilDate);
	}

	await query.delete();

	await logger.insert("API", "WARNING", "Some job notifications successfully deleted!", { ...params });

	return {
		message: "Some job notifications successfully deleted!",
		since_at: params.since_at || null,
		until_at: params.until_at || null
	};
};
