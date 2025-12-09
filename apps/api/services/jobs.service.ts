import { config } from "@voltage/config";
import { JobRequest, JobRow, JobOutputRow, JobOutputSpecs } from "@voltage/config/types";
import { database, storage } from "@voltage/utils";
import { uukey, getNow, getDate } from "@voltage/utils";
import { createJobNotification } from "@voltage/runtime/worker/notifier";
import { stats, logger } from "@voltage/utils";
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
		query = query.where(function () {
			this.where("key", "like", searchPattern)
				.orWhere("input", "like", searchPattern)
				.orWhere("outputs", "like", searchPattern)
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

	const job_key = uukey();
	const priority = body.priority ?? 1000;
	const now = getNow();

	// OUTPUTs: VALIDATE
	const outputs: Array<JobOutputRow> = [];

	for (let index = 0; index < body.outputs.length; index++) {
		const specs: JobOutputSpecs = body.outputs[index];

		outputs.push({
			key: uukey(),
			job_key,
			index,
			priority,
			specs,
			status: config.jobs.enqueue_on_receive ? "QUEUED" : "PENDING",
			updated_at: now,
			created_at: now,
			try_max: body.try_max ? body.try_max : config.jobs.try_count || 3,
			try_count: config.jobs.enqueue_on_receive ? 1 : 0,
			retry_in: body.retry_in ? body.retry_in : config.jobs.retry_in || 60 * 1000
			// retry_at: null,
			// locked_by: null
		});
	}

	if (outputs.length === 0) {
		throw new Error("OUTPUT_REQUIRED");
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
		priority,
		input: body.input ? body.input : null,
		destination: body.destination ? body.destination : null,
		notification: body.notification ? body.notification : null,
		metadata: body.metadata ? body.metadata : null,
		status: config.jobs.enqueue_on_receive ? "QUEUED" : "PENDING",
		updated_at: now,
		created_at: now,
		try_max: body.try_max ? body.try_max : config.jobs.try_count || 3,
		try_count: config.jobs.enqueue_on_receive ? 1 : 0,
		retry_in: body.retry_in ? body.retry_in : config.jobs.retry_in || 60 * 1000
		// retry_at: null,
		// locked_by: null
	};

	if ((job.try_max || 0) < config.jobs.try_min) {
		job.try_max = config.jobs.try_min;
	}

	if ((job.try_max || 0) > config.jobs.try_max) {
		job.try_max = config.jobs.try_max;
	}

	if ((job.retry_in || 0) < config.jobs.retry_in_min) {
		job.retry_in = config.jobs.retry_in_min;
	}

	if ((job.retry_in || 0) > config.jobs.retry_in_max) {
		job.retry_in = config.jobs.retry_in_max;
	}

	await database
		.table("jobs")
		.insert({
			...job,
			input: JSON.stringify(job.input),
			destination: job.destination ? JSON.stringify(job.destination) : null,
			notification: job.notification ? JSON.stringify(job.notification) : null,
			metadata: job.metadata ? JSON.stringify(job.metadata) : null
		})
		.then(async (result) => {
			await database
				.table("jobs_outputs")
				.insert(
					outputs.map((output) => ({
						...output,
						specs: JSON.stringify(output.specs),
						outcome: output.outcome ? JSON.stringify(output.outcome) : null,
						status: config.jobs.enqueue_on_receive ? "QUEUED" : "PENDING",
						updated_at: now,
						created_at: now
					}))
				)
				.then(async (result) => {
					await createJobNotification(job, "RECEIVED");

					await stats.update({
						jobs_recieved_count: 1,
						inputs_recieved_count: 1,
						outputs_requested_count: outputs.length || 0
					});

					await logger.insert("INFO", "Job request received!", { job_key });

					if (job.status === "QUEUED") {
						await database
							.table("jobs_queue")
							.insert({ key: job.key, priority: job.priority, created_at: job.created_at })
							.then(async (result) => {
								await logger.insert("INFO", "Received job successfully queued!", { job_key });
							})
							.catch(async (error) => {
								job.status = "PENDING";

								await database
									.table("jobs")
									.where("key", job_key)
									.update({
										outcome: JSON.stringify({ message: "Enqueuing received job failed!" }),
										status: job.status,
										updated_at: getNow()
									});

								await logger.insert("ERROR", "Enqueuing received job failed!", { job_key, ...error });
							});
					}

					await createJobNotification(job, job.status as string);
				})
				.catch(async (error) => {
					await createJobNotification(job, "FAILED");
					throw error;
				});
		})
		.catch(async (error) => {
			await createJobNotification(job, "FAILED");
			throw error;
		});

	return { ...job, outputs };
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

	await logger.insert("INFO", "Retrying job!", { job_key, output_key });

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

		await logger.insert("INFO", "All jobs permanently deleted!", { count: jobsKeysToHardDelete.length });
	}

	return { message: "All jobs permanently deleted!" };
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
		query = query.where(function () {
			this.where("key", "like", searchPattern)
				.orWhere("job_key", "like", searchPattern)
				.orWhere("specs", "like", searchPattern)
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
		query = query.where(function () {
			this.where("key", "like", searchPattern)
				.orWhere("job_key", "like", searchPattern)
				.orWhere("specs", "like", searchPattern)
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

	return {
		message: "Some job notifications successfully deleted!",
		since_at: params.since_at || null,
		until_at: params.until_at || null
	};
};
