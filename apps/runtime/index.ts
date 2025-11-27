import "dotenv/config";
import { config } from "@voltage/config";

import { storage, database, logger } from "@voltage/utils";
import { getInstanceKey, getInstanceSpecs, hash, getNow, subtractNow } from "@voltage/utils";

import path from "path";
import { spawn, ChildProcess } from "child_process";
import { createJobNotification, retryJobNotification } from "./worker/notifier.js";

// INSTANCE: KEY
const selfInstanceKey = getInstanceKey();
const workersProcessMap = new Map<string, ChildProcess>();

async function maintainInstancesAndWorkers() {
	logger.console("INFO", "Maintaining instances and workers...");

	let instances: any[] = [];
	let selfInstance: any = null;

	try {
		// INSTANCEs: SELECT
		instances = await database.table("instances").select("key", "type", "status", "updated_at"); // .orderBy("created_at", "asc")
	} catch (error: Error | any) {}

	if (instances) {
		// INSTANCE: UPDATE: SELF
		selfInstance = instances.filter((instance: any) => instance.key === selfInstanceKey)[0];
	}

	if (!selfInstance) {
		selfInstance = await initInstance(selfInstanceKey);
		instances.push(selfInstance);
	}

	await maintainInstance(selfInstanceKey);

	// INSTANCE: SELECT: MASTER
	const masterInstance = await getMasterInstance(instances);

	// INSTANCEs & WORKERs: MAINTAINING
	if (!masterInstance || masterInstance.key === selfInstanceKey) {
		// INSTANCE: UPDATE: SELF AS MASTER
		try {
			if (selfInstance.type !== "MASTER") {
				await setMasterInstance(selfInstanceKey);
			}
		} catch (error: Error | any) {}

		// INSTANCEs: WORKERs: UPDATE
		logger.console("INFO", "Maintaining workers...");

		// INSTANCEs: WORKERs: UPDATE: TIMEOUT
		try {
			const busyTimeout = config.runtime.workers.busy_timeout || 5 * 60 * 1000; // in milliseconds, default 5 minutes

			const timeoutedWorkers = await database
				.table("instances_workers")
				.where("status", "BUSY")
				.where("updated_at", "<=", subtractNow(busyTimeout, "milliseconds"));

			if (timeoutedWorkers.length > 0) {
				const timeoutedWorkerKeys = timeoutedWorkers.map((r: any) => r.key).filter(Boolean);

				for (const timeoutedWorkerKey of timeoutedWorkerKeys) {
					workersProcessMap.delete(timeoutedWorkerKey);
				}

				await database
					.table("instances_workers")
					.whereIn("key", timeoutedWorkerKeys)
					.update({
						job_key: null,
						status: "TIMEOUT",
						updated_at: getNow(),
						outcome: JSON.stringify({ message: "Busy worker timed out!" })
					});
			}
		} catch (error: Error | any) {
			await logger.insert("ERROR", "Timing out busy workers failed!", { error });
		}

		// INSTANCEs: WORKERs: UPDATE: IDLE
		try {
			const idleAfter = config.runtime.workers.idle_after || 1 * 10 * 1000; // in milliseconds, default 10 seconds

			await database
				.table("instances_workers")
				.where("status", "TIMEOUT")
				.where("updated_at", "<=", subtractNow(idleAfter, "milliseconds"))
				.update({
					job_key: null,
					status: "IDLE",
					updated_at: getNow(),
					outcome: JSON.stringify({ message: "Worker is idle again!" })
				});
		} catch (error: Error | any) {
			await logger.insert("ERROR", "The worker timed out and could not be updated!", { error });
		}

		logger.console("INFO", "Maintaining instances...");

		// INSTANCEs: UPDATE: OFFLINE
		try {
			const offlineTimeout = config.runtime.online_timeout || 1 * 60 * 1000; // in milliseconds, default 1 minute

			const inactiveInstances = await database
				.table("instances")
				.where("status", "ONLINE")
				.where("updated_at", "<=", subtractNow(offlineTimeout, "milliseconds"))
				.select("key");

			const inactiveInstanceKeys = inactiveInstances.map((r: any) => r.key).filter(Boolean);

			if (inactiveInstanceKeys.length > 0) {
				await database
					.table("instances_workers")
					.whereIn("instance_key", inactiveInstanceKeys)
					.update({
						job_key: null,
						status: "TERMINATED",
						updated_at: getNow(),
						outcome: JSON.stringify({ message: "The worker was terminated because the instance was offline!" })
					});

				await database
					.table("instances")
					.whereIn("key", inactiveInstanceKeys)
					.update({
						status: "OFFLINE",
						updated_at: getNow(),
						outcome: JSON.stringify({
							message: "The instance has gone offline because it has not been updated for a long time!"
						})
					});
			}
		} catch (error: Error | any) {
			await logger.insert("ERROR", "Unable to take offline instances that were not updated!", { error });
		}

		// INSTANCEs: DELETE: PURGE
		try {
			const purgeAfter = config.runtime.purge_after || 1 * 60 * 1000; // in milliseconds, default 1 minute

			const offlineInstances = await database
				.table("instances")
				.where("status", "OFFLINE")
				.where("updated_at", "<=", subtractNow(purgeAfter, "milliseconds"))
				.select("key");

			const offlineInstanceKeys = offlineInstances.map((r: any) => r.key).filter(Boolean);

			if (offlineInstanceKeys.length > 0) {
				await database.table("instances_workers").whereIn("instance_key", offlineInstanceKeys).delete();
				await database.table("instances").whereIn("key", offlineInstanceKeys).delete();
			}
		} catch (error: Error | any) {
			await logger.insert("ERROR", "Purging offline instances failed!", { error });
		}
	}

	setTimeout(() => maintainInstancesAndWorkers(), config.runtime.maintain_interval || 60000);
}

async function initInstance(instanceKey: string, instance: any = null): Promise<any> {
	await logger.insert("INFO", `Initializing instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""}...`);

	const now = getNow();
	const specs = getInstanceSpecs();

	// INSTANCE: WORKERs: MISSINGs
	try {
		// INSTANCE: WORKERs: COUNT
		const existsWorkersCount = await database
			.table("instances_workers")
			.where("instance_key", instanceKey)
			.count("* as count")
			.first()
			.then((result: any) => result?.count || 0);
		const missingWorkersCount = config.runtime.workers.max - existsWorkersCount;

		// INSTANCE: WORKERs: INSERT
		if (missingWorkersCount > 0) {
			const newWorkers = Array.from({ length: missingWorkersCount }, (_, index) => ({
				key: hash(`${instanceKey}:${existsWorkersCount + index}`),
				index: existsWorkersCount + index,
				instance_key: instanceKey,
				job_key: null,
				status: "IDLE",
				updated_at: now,
				created_at: now
			}));

			await database.table("instances_workers").insert(newWorkers);

			logger.console(
				"INFO",
				`${missingWorkersCount} new workers initialized for instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""}!`
			);
		}
	} catch (error: Error | any) {}

	// INSTANCE: WORKERs: EXISTs
	try {
		await database
			.table("instances_workers")
			.where("instance_key", instanceKey)
			.update({
				job_key: null,
				outcome: null,
				status: database.knex.raw(`CASE WHEN \`index\` < ? THEN 'IDLE' ELSE 'TERMINATED' END`, [config.runtime.workers.max]),
				updated_at: now
			});
	} catch (error: Error | any) {}

	try {
		if (!instance) {
			// INSTANCE: INSERT
			await database.table("instances").insert({
				key: instanceKey,
				specs: JSON.stringify(specs),
				status: "ONLINE",
				updated_at: now,
				created_at: now
			});

			await logger.insert("INFO", `Instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""} created!`);

			return await database.table("instances").where("key", instanceKey).first();
		}

		// INSTANCE: UPDATE
		await database
			.table("instances")
			.where("key", instanceKey)
			.update({
				specs: JSON.stringify(specs),
				status: "ONLINE",
				outcome: null,
				updated_at: now,
				restart_count: database.knex.raw("restart_count + 1")
			});

		await logger.insert(
			"WARNING",
			`Instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""} restarted (${(instance.restart_count || 0) + 1} times)!`
		);

		return instance;
	} catch (error: Error | any) {
		await logger.insert("ERROR", `Instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""} initialization failed!`, {
			error
		});
	}
}

async function maintainInstance(instanceKey: string): Promise<void> {
	logger.console("INFO", `Maintaining instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""}...`);

	try {
		// INSTACE: UPDATE
		await database
			.table("instances")
			.where("key", instanceKey)
			.update({
				specs: JSON.stringify(getInstanceSpecs()),
				status: "ONLINE",
				updated_at: getNow()
			});

		// INSTANCE: WORKERs: UPDATE
		await database
			.table("instances_workers")
			.where("instance_key", instanceKey)
			.where("status", "IDLE")
			.update({ updated_at: getNow() });

		logger.console("INFO", `Instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""} successfully maintained!`);
	} catch (error: Error | any) {
		await logger.insert("ERROR", `Instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""} maintenance failed!`, {
			error
		});
	}
}

async function getMasterInstance(instances: any[]): Promise<any | null> {
	try {
		if (!instances.length) {
			logger.console("ERROR", "No instances found!");
			return null;
		}

		const offlineTimeout = config.runtime.online_timeout || 1 * 60 * 1000; // in milliseconds, default 1 minute

		const activeInstances = instances.filter(
			(instance: any) => instance.status === "ONLINE" && instance.updated_at > subtractNow(offlineTimeout, "milliseconds")
		);

		if (!activeInstances.length) {
			logger.console("ERROR", "No active instances found!");
			return null;
		}

		let masterInstance = activeInstances.filter((instance: any) => instance.type === "MASTER")[0];

		if (!masterInstance) {
			masterInstance = activeInstances[0];
			masterInstance.type = "MASTER";
			await setMasterInstance(masterInstance.key);
		}

		return masterInstance;
	} catch (error: Error | any) {
		logger.console("ERROR", "Selecting MASTER instance failed!", { error });
		return null;
	}
}

async function setMasterInstance(instanceKey: string): Promise<void> {
	logger.console("INFO", `Setting instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""} as MASTER...`);

	try {
		await database.table("instances").where("type", "MASTER").whereNot("key", instanceKey).update({ type: "SLAVE" });
		await database.table("instances").where("key", instanceKey).update({ type: "MASTER" });

		await logger.insert("INFO", `Instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""} is now MASTER!`);
	} catch (error: Error | any) {
		logger.console("ERROR", `Setting instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""} as MASTER failed!`, {
			error
		});
	}
}

async function processJobs(): Promise<void> {
	// JOBs: PENDINGs
	logger.console("INFO", "Enqueuing pending jobs...");

	try {
		// JOBs: PENDINGs: LOCK
		await database
			.table("jobs")
			// .where('try_count', '<', 'try_max')
			.where(function () {
				this.where("status", "PENDING").orWhere(function () {
					this.where("status", "RETRYING").where("retry_at", "<=", getNow());
				});
			})
			.where("locked_by", null)
			.orderBy("priority", "asc")
			.orderBy("created_at", "asc")
			.limit(config.jobs.enqueue_limit || 10) // default 10
			.update({ updated_at: getNow(), locked_by: selfInstanceKey });
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to select pending jobs!", { error });
	}

	try {
		// JOBs: PENDINGs: SELECT LOCKEDs
		const pendingJobs = await database.table("jobs").where("locked_by", selfInstanceKey);

		for (const pendingJob of pendingJobs) {
			// JOB: UPDATE: QUEUED
			await database.table("jobs").where("key", pendingJob.key).update({ status: "QUEUED", updated_at: getNow(), locked_by: null });

			// JOB: QUEUE: INSERT
			await database
				.table("jobs_queue")
				.insert({ key: pendingJob.key, priority: pendingJob.priority, created_at: pendingJob.created_at })
				.then(async (result) => {
					await createJobNotification(pendingJob, "QUEUED");
					await logger.insert("INFO", "Job successfully queued!", { job_key: pendingJob.key });
				})
				.catch(async (error) => {
					// JOB: UPDATE: PENDING
					await database
						.table("jobs")
						.where("key", pendingJob.key)
						.update({ status: "PENDING", updated_at: getNow(), locked_by: null });

					await logger.insert("ERROR", "Enqueuing pending job failed!", { job_key: pendingJob.key, error });
				});
		}

		// JOBs: PENDINGs: RELEASE
		await database.table("jobs").where("locked_by", selfInstanceKey).update({ updated_at: getNow(), locked_by: null });
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to enqueuing pending jobs!", { error });
	}

	// JOBs: QUEUEDs: PROCESSING
	logger.console("INFO", "Processing jobs queue...");

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
					await logger.insert("INFO", "Spawning worker for job...", { worker_key: idleWorker.key, job_key: queuedJob.key });

					// WORKER: UPDATE: BUSY
					await database.table("instances_workers").where("key", idleWorker.key).update({ status: "BUSY", updated_at: getNow() });

					await spawnWorkerForJob(selfInstanceKey, idleWorker.key, queuedJob.key);

					// JOB: QUEUE: DELETE
					await database.table("jobs_queue").where("key", queuedJob.key).delete();

					await logger.insert("INFO", "Spawned worker for job...", { worker_key: idleWorker.key, job_key: queuedJob.key });
				} catch (error: Error | any) {
					// WORKER: UPDATE: BUSY
					await database.table("instances_workers").where("key", idleWorker.key).update({ status: "IDLE", updated_at: getNow() });

					await logger.insert("ERROR", "Failed to spawn worker for job!", {
						worker_key: idleWorker.key,
						job_key: queuedJob.key,
						error
					});
				}
			}

			// JOBs: QUEUEDs: RELEASE
			if (queuedJobs.length > 0) {
				await database.table("jobs_queue").where("locked_by", selfInstanceKey).update({ locked_by: null });
			}
		} catch (error: Error | any) {
			await logger.insert("ERROR", "Failed to poll jobs!", { error });
		}
	}

	// JOBs: TIMEOUTs
	if (config.jobs.process_timeout > 0) {
		logger.console("INFO", "Jobs are timing out...");

		try {
			await database
				.table("jobs")
				.whereNotIn("status", ["COMPLETED", "CANCELLED", "FAILED", "TIMEOUT"])
				.where("updated_at", "<=", subtractNow(config.jobs.process_timeout || 10 * 60 * 1000, "milliseconds")) // in milliseconds, default 10 minutes
				.where("try_count", ">", 0)
				.update({ status: "TIMEOUT" });
		} catch (error: Error | any) {
			await logger.insert("ERROR", "Jobs could not be timed out!", { error });
		}
	}

	setTimeout(() => processJobs(), config.jobs.process_interval || 10000); // default 10 seconds
}

async function processJobsNotifications(): Promise<void> {
	// JOBs: NOTIFICATIONs: PROCESSING
	logger.console("INFO", "Processing jobs notifications queue...");

	try {
		// JOBs: NOTIFICATIONs: QUEUE: LOCK
		await database
			.table("jobs_notifications_queue")
			// .where('try_count', '<', 'try_max')
			.where(function () {
				this.where("status", "PENDING").orWhere(function () {
					this.where("status", "RETRYING").where("retry_at", "<=", getNow());
				});
			})
			.where("locked_by", null)
			.orderBy("priority", "asc")
			.orderBy("created_at", "asc")
			.limit(config.jobs.notifications.process_limit || 10) // default 10
			.update({ locked_by: selfInstanceKey }); // updated_at: getNow(),

		// JOBs: NOTIFICATIONs: QUEUE: SELECT LOCKEDs
		const pendingJobsNotifications = await database.table("jobs_notifications_queue").where("locked_by", selfInstanceKey);

		for (const pendingNotification of pendingJobsNotifications) {
			await retryJobNotification(pendingNotification);
		}

		// JOBs: QUEUEDs: RELEASE
		await database.table("jobs_notifications_queue").where("locked_by", selfInstanceKey).update({ locked_by: null });
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to process jobs notifications queue!", { error });
	}

	setTimeout(() => processJobsNotifications(), config.jobs.notifications.process_interval || 60000); // default 1 minute
}

async function spawnWorkerForJob(instanceKey: string, workerKey: string, jobKey: string): Promise<any> {
	try {
		// JOB: NOTIFICATIONs: UPDATE
		// await database.table('jobs_notifications').where('job_key', job_key).update({ instance_key, worker_key: worker_key });

		// WORKER: CREATE
		let child: ChildProcess;

		if (config.env === "local") {
			const workerScriptPath = path.join(process.cwd(), "worker", "index.ts");
			child = spawn("npx", ["tsx", workerScriptPath, instanceKey, workerKey, jobKey], {
				stdio: ["inherit", "inherit", "inherit"],
				cwd: process.cwd(),
				shell: true
			});
		} else {
			const workerScriptPath = path.join(process.cwd(), "dist", "worker", "index.js");
			child = spawn("node", [workerScriptPath, instanceKey, workerKey, jobKey], {
				stdio: ["inherit", "inherit", "inherit"],
				cwd: process.cwd()
			});
		}

		// WORKER: EVENTs
		child.on("exit", async (code, signal) => {
			logger.console("INFO", "Worker exited!", { worker_key: workerKey, job_key: jobKey, code, signal });
			workersProcessMap.delete(workerKey);

			// WORKER: UPDATE
			await database
				.table("instances_workers")
				.where("key", workerKey)
				.update({
					job_key: null,
					status: "IDLE",
					updated_at: getNow(),
					outcome: JSON.stringify({ message: "Worker exited!", exit_code: code, exit_signal: signal })
				})
				.catch((error) => {
					logger.insert("ERROR", "Failed to idle worker!", { worker_key: workerKey, job_key: jobKey, error });
				});
		});

		child.on("error", async (error) => {
			await logger.insert("ERROR", "Worker exited due error!", { worker_key: workerKey, job_key: jobKey, error });
			workersProcessMap.delete(workerKey);

			// WORKER: UPDATE
			await database
				.table("instances_workers")
				.where("key", workerKey)
				.update({
					job_key: null,
					status: "IDLE",
					updated_at: getNow(),
					outcome: JSON.stringify({ message: error.message || "Unknown error occurred!", exit_signal: "ERROR" })
				})
				.catch((error) => {
					logger.insert("ERROR", "Failed to idle worker!", { worker_key: workerKey, job_key: jobKey, error });
				});
		});

		workersProcessMap.set(workerKey, child);

		logger.console("INFO", "Worker successfully spawned for the job!", { worker_key: workerKey, job_key: jobKey });
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to spawn worker for the job!", { job_key: jobKey, error });
		throw error;
	}
}

async function cleanup() {
	if (config.jobs.retention > 0) {
		// JOBs: CLEANUP
		logger.console("INFO", "Cleaning up completed jobs...");

		const jobs = await database
			.table("jobs")
			.select("key")
			.where("status", "COMPLETED")
			.whereNotNull("completed_at")
			.where("completed_at", "<=", subtractNow(config.jobs.retention || 24 * 60 * 60 * 1000, "milliseconds")); // in milliseconds, default 24 hours

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

			logger.console("INFO", "Jobs cleaning completed!", { count: jobsKeys.length });
		}
	}

	// STATs: CLEANUP
	if ((config.stats.retention || 365 * 24 * 60 * 60 * 1000) > 0) {
		// in milliseconds, default 365 days
		logger.console("INFO", "Cleaning stats...");

		await database
			.table("stats")
			.where("date", "<=", subtractNow(config.stats.retention || 365 * 24 * 60 * 60 * 1000, "milliseconds"))
			.delete(); // in milliseconds, default 365 days

		logger.console("INFO", "Stats cleaning completed!");
	}

	// LOGS: CLEANUP
	if (!config.logs.is_disabled || (config.logs.retention || 60 * 60 * 1000) > 0) {
		// in milliseconds, default 1 hour
		logger.console("INFO", "Cleaning logs...");

		await database
			.table("logs")
			.where("created_at", "<=", subtractNow(config.logs.retention || 60 * 60 * 1000, "milliseconds"))
			.delete(); // in milliseconds, default 1 hour

		logger.console("INFO", "Logs cleaning completed!");
	}

	setTimeout(() => cleanup(), config.database.cleanup_interval || 60 * 60 * 1000); // in milliseconds, default 1 hour
}

process.on("SIGINT", (signal) => gracefulShutdown(signal));
process.on("SIGTERM", (signal) => gracefulShutdown(signal));
process.on("SIGQUIT", (signal) => gracefulShutdown(signal));

const gracefulShutdown = async (signal: string) => {
	await logger.insert("INFO", `Runtime received :signal, shutting down gracefully!`, { signal });

	try {
		// DB: WORKERs: UPDATE
		try {
			await database
				.table("instances_workers")
				.where("instance_key", selfInstanceKey)
				.update({
					job_key: null,
					status: "TERMINATED",
					updated_at: getNow(),
					outcome: JSON.stringify({ message: "The worker was terminated because the instance was shutdown!", signal })
				});
		} catch (error: Error | any) {
			await logger.insert("ERROR", "Failed to update workers for instance during shutdown!", { error });
		}

		// DB: INSTANCE: UPDATE
		try {
			await database
				.table("instances")
				.where("key", selfInstanceKey)
				.update({
					specs: JSON.stringify(getInstanceSpecs()),
					status: "OFFLINE",
					updated_at: getNow(),
					outcome: JSON.stringify({ message: "The instance has gone offline due to shutdown!", signal })
				});
		} catch (error: Error | any) {
			await logger.insert("ERROR", "Failed to update instance during shutdown!", { error });
		}

		await logger.insert("INFO", "Runtime shutdown completed!");
	} catch (error: Error | any) {
		logger.insert("ERROR", "Error during runtime shutdown!", { error });
	}

	process.exit(0);
};

async function init() {
	logger.setMetadata({ instance_key: selfInstanceKey });
	await storage.config(config.storage);
	database.config(config.database);
	await database.verifySchemaExists();

	await logger.insert("INFO", "Starting runtime service...");

	try {
		// INSTANCE: SELECT: SELF
		const selfInstance = await database.table("instances").where("key", selfInstanceKey).first();

		await initInstance(selfInstanceKey, selfInstance);
		await maintainInstancesAndWorkers();
		await processJobs();
		await processJobsNotifications();
		await cleanup();
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to start runtime service!", { error });
		throw error;
	}
}

init().catch((err) => {
	// Final catch to avoid unhandled rejections
	logger.console("ERROR", "Runtime initialization failed!", { error: err });
});
