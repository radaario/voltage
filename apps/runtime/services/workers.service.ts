import { config } from "@voltage/config";
import { database, logger, getInstanceKey, hash, getNow, subtractNow } from "@voltage/utils";
import { Worker, WorkerOutcome, WorkersProcessMap } from "@/types/index.js";
import path from "path";
import { spawn, ChildProcess } from "child_process";

const selfInstanceKey = getInstanceKey();

export const maintainInstanceWorkers = async (instanceKey: string): Promise<void> => {
	logger.console("INSTANCE", "INFO", `Maintaining instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""} workers...`);

	const now = getNow();

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
				"INSTANCE",
				"INFO",
				`${missingWorkersCount} new workers initialized for instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""}!`
			);
		}
	} catch (error: Error | any) {
		await logger.insert(
			"INSTANCE",
			"ERROR",
			`Instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""} workers maintenance failed!`,
			{
				...error
			}
		);
	}

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

		logger.console(
			"INSTANCE",
			"INFO",
			`Instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""} workers successfully maintained!`
		);
	} catch (error: Error | any) {
		await logger.insert(
			"INSTANCE",
			"ERROR",
			`Instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""} workers maintenance failed!`,
			{
				...error
			}
		);
	}
};

export const timeoutBusyWorkers = async (): Promise<string[] | undefined> => {
	try {
		const busyTimeout = config.runtime.workers.busy_timeout || 5 * 60 * 1000; // in milliseconds, default 5 minutes
		const now = getNow();

		const timeoutedWorkers = await database
			.table("instances_workers")
			.where("status", "BUSY")
			.where("updated_at", "<=", subtractNow(busyTimeout, "milliseconds"));

		if (timeoutedWorkers.length > 0) {
			const timeoutedWorkerKeys = timeoutedWorkers.map((r: any) => r.key).filter(Boolean);

			await database
				.table("instances_workers")
				.whereIn("key", timeoutedWorkerKeys)
				.update({
					job_key: null,
					status: "TIMEOUT",
					updated_at: now,
					outcome: JSON.stringify({ message: "Busy worker timed out!" })
				});

			return timeoutedWorkerKeys;
		}
	} catch (error: Error | any) {
		await logger.insert("INSTANCE", "ERROR", "Timing out busy workers failed!", { ...error });
	}
};

export const idleTimeoutWorkers = async (): Promise<void> => {
	try {
		const idleAfter = config.runtime.workers.idle_after || 1 * 10 * 1000; // in milliseconds, default 10 seconds
		const now = getNow();

		await database
			.table("instances_workers")
			.where("status", "TIMEOUT")
			.where("updated_at", "<=", subtractNow(idleAfter, "milliseconds"))
			.update({
				job_key: null,
				outcome: JSON.stringify({ message: "Worker is idle again!" }),
				status: "IDLE",
				updated_at: now
			});
	} catch (error: Error | any) {
		await logger.insert("INSTANCE", "ERROR", "The worker timed out and could not be updated!", { ...error });
	}
};

export const spawnInstanceWorkerForJob = async (
	workersProcessMap: WorkersProcessMap,
	instanceKey: string,
	workerKey: string,
	jobKey: string
): Promise<void> => {
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
			console.log("Spawning worker with tsx:", workerScriptPath);
			child = spawn("node", [workerScriptPath, instanceKey, workerKey, jobKey], {
				stdio: ["inherit", "inherit", "inherit"],
				cwd: process.cwd()
				// shell: true
			});
		}

		// WORKER: EVENTs
		child.on("exit", async (code, signal) => {
			logger.console("INSTANCE", "INFO", "Worker exited!", {
				instace_key: instanceKey,
				worker_key: workerKey,
				job_key: jobKey,
				code,
				signal
			});

			workersProcessMap.delete(workerKey);
			await idleInstanceWorker(instanceKey, workerKey, { message: "Worker exited!", exit_code: code, exit_signal: signal });
		});

		child.on("error", async (error: Error | any) => {
			await logger.insert("INSTANCE", "ERROR", "Worker exited due error!", {
				instace_key: instanceKey,
				worker_key: workerKey,
				job_key: jobKey,
				...error
			});

			workersProcessMap.delete(workerKey);

			await idleInstanceWorker(instanceKey, workerKey, { message: error.message || "Unknown error occurred!", exit_signal: "ERROR" });
		});

		workersProcessMap.set(workerKey, child);

		logger.console("INSTANCE", "INFO", "Worker successfully spawned for the job!", { worker_key: workerKey, job_key: jobKey });
	} catch (error: Error | any) {
		await logger.insert("INSTANCE", "ERROR", "Failed to spawn worker for the job!", { job_key: jobKey, ...error });
		throw error;
	}
};

export const idleInstanceWorker = async (instanceKey: string, workerKey: string, outcome: WorkerOutcome | null = null): Promise<void> => {
	try {
		// WORKER: UPDATE
		await database
			.table("instances_workers")
			.where("key", workerKey)
			.update({
				job_key: null,
				outcome: outcome ? JSON.stringify(outcome) : null,
				status: "IDLE",
				updated_at: getNow()
			});

		await logger.insert("INSTANCE", "INFO", "Worker idled successfully!", { instace_key: instanceKey, worker_key: workerKey, outcome });
	} catch (error: Error | any) {
		await logger.insert("INSTANCE", "ERROR", "Failed to idle worker!", {
			instace_key: instanceKey,
			worker_key: workerKey,
			outcome,
			...error
		});
	}
};

export const terminateInstanceWorkers = async (instanceKey: string, signal: string): Promise<void> => {
	try {
		const now = getNow();

		await database
			.table("instances_workers")
			.where("instance_key", instanceKey)
			.update({
				job_key: null,
				status: "TERMINATED",
				updated_at: now,
				outcome: JSON.stringify({ message: "The worker was terminated because the instance was shutdown!", signal })
			});
	} catch (error: Error | any) {
		await logger.insert("INSTANCE", "ERROR", "Failed to update workers for instance during shutdown!", { ...error });
	}
};

export const terminateInactiveInstanceWorkers = async (inactiveInstanceKeys: string[]): Promise<void> => {
	const now = getNow();

	await database
		.table("instances_workers")
		.whereIn("instance_key", inactiveInstanceKeys)
		.update({
			job_key: null,
			outcome: JSON.stringify({ message: "The worker was terminated because the instance was offline!" }),
			status: "TERMINATED",
			updated_at: now
		});
};
