import { config } from "@voltage/config";
import { database, logger, getInstanceKey, getNow, subtractNow } from "@voltage/utils";
import { createJobNotification } from "@/worker/notifier.js";
import { WorkersProcessMap } from "@/types/index.js";
import { spawnInstanceWorkerForJob } from "@/services/workers.service.js";

const selfInstanceKey = getInstanceKey();

export const timeoutQueuedJobs = async (): Promise<void> => {
	const now = getNow();

	try {
		// JOBs: QUEUEs: TIMEOUT
		await database
			.table("jobs")
			.where("status", "QUEUED")
			.where("updated_at", "<=", subtractNow(config.jobs.queue_timeout || 5 * 60 * 1000, "milliseconds")) // in milliseconds, default 5 minutes
			.update({
				outcome: database.knex.raw(
					`CASE WHEN \`try_count\` >= \`try_max\` THEN '{"message":"Job queue didn\\'t processed and it failed!"}' ELSE \`outcome\` END`
				),
				status: database.knex.raw(`CASE WHEN \`try_count\` < \`try_max\` THEN 'PENDING' ELSE 'FAILED' END`),
				started_at: null,
				completed_at: null,
				updated_at: now,
				locked_by: null,
				try_count: database.knex.raw(`CASE WHEN \`try_count\` < \`try_max\` THEN \`try_count\` + 1 ELSE \`try_count\` END`),
				retry_at: null
			});
	} catch (error: Error | any) {}
};

export const enqueuePendingJobs = async (): Promise<void> => {
	const now = getNow();

	try {
		// JOBs: PENDINGs: LOCK
		await database
			.table("jobs")
			// .where('try_count', '<', 'try_max')
			.where(function () {
				this.where("status", "PENDING").orWhere(function () {
					this.where("status", "RETRYING").where("retry_at", "<=", now);
				});
			})
			.where("locked_by", null)
			.orderBy("priority", "asc")
			.orderBy("created_at", "asc")
			.limit(config.jobs.enqueue_limit || 10) // default 10
			.update({ updated_at: now, locked_by: selfInstanceKey });
	} catch (error: Error | any) {
		await logger.insert("INSTANCE", "ERROR", "Failed to select pending jobs!", { ...error });
	}

	try {
		// JOBs: PENDINGs: SELECT LOCKEDs
		const pendingJobs = await database.table("jobs").where("locked_by", selfInstanceKey);

		for (const pendingJob of pendingJobs) {
			pendingJob.try_count = pendingJob.try_count + 1;

			// JOB: UPDATE: QUEUED
			await database.table("jobs").where("key", pendingJob.key).update({
				status: "QUEUED",
				updated_at: now,
				locked_by: null,
				try_count: pendingJob.try_count
			});

			// JOB: QUEUE: INSERT
			await database
				.table("jobs_queue")
				.insert({
					key: pendingJob.key,
					priority: pendingJob.priority,
					created_at: pendingJob.created_at
				})
				.then(async (result) => {
					await createJobNotification(pendingJob, "QUEUED");
					await logger.insert("INSTANCE", "INFO", "Pending job successfully queued!", { job_key: pendingJob.key });
				})
				.catch(async (error: Error | any) => {
					// JOB: UPDATE: PENDING || FAILED
					await database
						.table("jobs")
						.where("key", pendingJob.key)
						.update({
							outcome: JSON.stringify({ message: "Enqueuing pending job failed!" }),
							status: pendingJob.try_count < pendingJob.try_max ? "PENDING" : "FAILED",
							updated_at: now,
							locked_by: null
							// try_count: pendingJob.try_count
						});

					await logger.insert("INSTANCE", "ERROR", "Enqueuing pending job failed!", { job_key: pendingJob.key, ...error });
				});
		}

		// JOBs: PENDINGs: RELEASE
		await database.table("jobs").where("locked_by", selfInstanceKey).update({ updated_at: now, locked_by: null });
	} catch (error: Error | any) {
		await logger.insert("INSTANCE", "ERROR", "Failed to enqueuing pending jobs!", { ...error });
	}
};

export const processJobsQueue = async (workersProcessMap: WorkersProcessMap): Promise<void> => {
	const now = getNow();

	const idleWorkers = await database
		.table("instances_workers")
		.where("instance_key", selfInstanceKey)
		.where("status", "IDLE")
		.orderBy("index", "asc");

	if (idleWorkers.length > 0) {
		try {
			// JOBs: QUEUEDs: LOCK
			await database
				.table("jobs_queue")
				.where("locked_by", null)
				.update({ locked_by: selfInstanceKey })
				.orderBy("priority", "asc")
				.orderBy("created_at", "asc")
				.limit(idleWorkers.length);

			// JOBs: QUEUEDs: LOCKEDs
			const queuedJobs = await database.table("jobs_queue").where("locked_by", selfInstanceKey);

			for (let index = 0; index < queuedJobs.length; index++) {
				const idleWorker = idleWorkers[index];
				const queuedJob = queuedJobs[index];

				try {
					await logger.insert("INSTANCE", "INFO", "Spawning worker for job...", {
						worker_key: idleWorker.key,
						job_key: queuedJob.key
					});

					// WORKER: UPDATE: BUSY
					await database.table("instances_workers").where("key", idleWorker.key).update({ status: "BUSY", updated_at: now });

					await spawnInstanceWorkerForJob(workersProcessMap, selfInstanceKey, idleWorker.key, queuedJob.key);

					// JOB: QUEUE: DELETE
					await database.table("jobs_queue").where("key", queuedJob.key).delete();

					await logger.insert("INSTANCE", "INFO", "Spawned worker for job...", {
						worker_key: idleWorker.key,
						job_key: queuedJob.key
					});
				} catch (error: Error | any) {
					// WORKER: UPDATE: BUSY
					await database.table("instances_workers").where("key", idleWorker.key).update({ status: "IDLE", updated_at: now });

					await logger.insert("INSTANCE", "ERROR", "Failed to spawn worker for job!", {
						worker_key: idleWorker.key,
						job_key: queuedJob.key,
						...error
					});
				}
			}

			// JOBs: QUEUEDs: RELEASE
			if (queuedJobs.length > 0) {
				await database.table("jobs_queue").where("locked_by", selfInstanceKey).update({ locked_by: null });
			}
		} catch (error: Error | any) {
			await logger.insert("INSTANCE", "ERROR", "Failed to poll jobs!", { ...error });
		}
	}
};

export const timeoutProcessingJobs = async (): Promise<void> => {
	if (config.jobs.process_timeout > 0) {
		const now = getNow();

		try {
			await database
				.table("jobs")
				.whereNotIn("status", ["COMPLETED", "CANCELLED", "FAILED", "TIMEOUT"])
				.where("updated_at", "<=", subtractNow(config.jobs.process_timeout || 30 * 60 * 1000, "milliseconds")) // in milliseconds, default 30 minutes
				.where("try_count", ">", 0)
				.update({
					outcome: JSON.stringify({ message: "Job processing timed out!" }),
					status: "TIMEOUT",
					progress: 0.0,
					completed_at: now,
					updated_at: now
				});
		} catch (error: Error | any) {
			await logger.insert("INSTANCE", "ERROR", "Jobs could not be timed out!", { ...error });
		}
	}
};
