import { config } from "@voltage/config";
import { JobRequest, JobRow, OutputSpecs } from "@voltage/config/types";
import { database, storage } from "@voltage/utils";
import { uukey, getNow, getDate } from "@voltage/utils";
import { createJobNotification } from "@voltage/runtime/worker/notifier";
import { stats, logger } from "@voltage/utils";
import { PaginationParams } from "@/types";

export const getJob = async (job_key: string) => {
	const job = await database.table("jobs").where("key", job_key).first();

	if (!job) {
		throw new Error("NOT_FOUND");
	}

	return job;
};

export const getJobs = async (
	pagination: PaginationParams,
	filters: {
		instance_key?: string;
		worker_key?: string;
		status?: string;
		q?: string;
	}
) => {
	let query = database.table("jobs");

	if (filters.instance_key) query = query.where("instance_key", filters.instance_key);
	if (filters.worker_key) query = query.where("worker_key", filters.worker_key);
	if (filters.status) query = query.where("status", filters.status);

	if (filters.q) {
		const searchPattern = `%${filters.q}%`;
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

	const totalResult = await query.clone().count("* as total").first();
	const total = (totalResult as any).total;

	const jobs = await query.orderBy("created_at", "desc").limit(pagination.limit).offset(pagination.offset);

	return { jobs, total };
};

export const createJob = async (body: JobRequest) => {
	if (!body || !body.input || !Array.isArray(body.outputs) || body.outputs.length === 0) {
		throw new Error("REQUEST_INVALID");
	}

	const job_key = uukey();
	const priority = body.priority ?? 1000;
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
		priority: priority,
		input: body.input ? body.input : null,
		outputs: outputs ? outputs : null,
		destination: body.destination ? body.destination : null,
		notification: body.notification ? body.notification : null,
		metadata: body.metadata ? body.metadata : null,
		status: config.jobs.enqueue_on_receive ? "QUEUED" : "PENDING",
		updated_at: now,
		created_at: now,
		locked_by: null,
		try_max: body.try_max ? body.try_max : config.jobs.try_count || 3,
		try_count: config.jobs.enqueue_on_receive ? 1 : 0,
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

	return job;
};

export const retryJob = async (job_key: string, output_key?: string) => {
	if (!job_key) {
		throw new Error("KEY_REQUIRED");
	}

	const job = await database.table("jobs").where("key", job_key).first();

	if (!job) {
		throw new Error("NOT_FOUND");
	}

	if (!["CANCELLED", "DELETED", "FAILED", "TIMEOUT"].includes(job.status)) {
		throw new Error("NOT_ALLOWED");
	}

	const now = getNow();
	let jobOutputsUpdatedCount = 0;
	job.outputs = job.outputs ? JSON.parse(job.outputs as string) : null;

	if (job.outputs) {
		for (let index = 0; index < job.outputs.length; index++) {
			if ((!output_key || output_key == job.outputs[index].key) && !["COMPLETED"].includes(job.outputs[index].status)) {
				job.outputs[index].outcome = null;
				job.outputs[index].status = "PENDING";
				job.outputs[index].updated_at = now;
				jobOutputsUpdatedCount++;
			}
		}
	}

	if (jobOutputsUpdatedCount <= 0) {
		throw new Error("NOT_ALLOWED");
	}

	await database
		.table("jobs")
		.where("key", job_key)
		.update({
			outputs: job.outputs ? JSON.stringify(job.outputs) : null,
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
	}

	if (jobsKeysToHardDelete.length > 0) {
		// Delete job folders/objects via unified storage facade
		for (const job_key of jobsKeysToHardDelete) {
			try {
				await storage.delete(`/jobs/${job_key}/`);
			} catch (error: Error | any) {}
		}

		await database.table("jobs").whereIn("key", jobsKeysToHardDelete).delete();
		await database.table("jobs_queue").whereIn("key", jobsKeysToHardDelete).delete();
		await database.table("jobs_notifications").whereIn("job_key", jobsKeysToHardDelete).delete();
		await database.table("jobs_notifications_queue").whereIn("job_key", jobsKeysToHardDelete).delete();

		await logger.insert("INFO", "All jobs permanently deleted!", { count: jobsKeysToHardDelete.length });
	}

	return { message: "All jobs permanently deleted!" };
};
