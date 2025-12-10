import "dotenv/config";
import { config } from "@voltage/config";
import { storage, database, logger, getInstanceKey, getInstanceSpecs, getNow } from "@voltage/utils";
import { WorkersProcessMap } from "@/types/index.js";
import { restartInstance } from "@/services/instances.service.js";
import { maintainInstancesAndWorkers } from "@/services/maintenance.service.js";
import { timeoutQueuedJobs, enqueuePendingJobs, processJobsQueue, timeoutProcessingJobs } from "@/services/jobs.service.js";
import { processJobsNotifications } from "@/services/notifications.service.js";
import { cleanupCompletedJobs, cleanupStats, cleanupLogs } from "@/services/cleanup.service.js";
import { terminateInstanceWorkers } from "@/services/workers.service.js";

const selfInstanceKey = getInstanceKey();
const workersProcessMap: WorkersProcessMap = new Map();

async function processJobs(): Promise<void> {
	// JOBs: PENDINGs
	logger.console("INSTANCE", "INFO", "Enqueuing pending jobs...");

	await timeoutQueuedJobs();
	await enqueuePendingJobs();

	// JOBs: QUEUEDs: PROCESSING
	logger.console("INSTANCE", "INFO", "Processing jobs queue...");

	await processJobsQueue(workersProcessMap);

	// JOBs: TIMEOUTs
	logger.console("INSTANCE", "INFO", "Jobs are timing out...");

	await timeoutProcessingJobs();

	setTimeout(() => processJobs(), config.jobs.process_interval || 10000); // default 10 seconds
}

async function processNotificationsQueue(): Promise<void> {
	// JOBs: NOTIFICATIONs: PROCESSING
	logger.console("INSTANCE", "INFO", "Processing jobs notifications queue...");

	await processJobsNotifications();

	setTimeout(() => processNotificationsQueue(), config.jobs.notifications.process_interval || 60000); // default 1 minute
}

async function cleanup() {
	await cleanupCompletedJobs();
	await cleanupStats();
	await cleanupLogs();

	setTimeout(() => cleanup(), config.database.cleanup_interval || 60 * 60 * 1000); // in milliseconds, default 1 hour
}

async function maintenanceLoop() {
	await maintainInstancesAndWorkers();
	setTimeout(() => maintenanceLoop(), config.runtime.maintain_interval || 60000);
}

process.on("SIGINT", (signal) => gracefulShutdown(signal));
process.on("SIGTERM", (signal) => gracefulShutdown(signal));
process.on("SIGQUIT", (signal) => gracefulShutdown(signal));

const gracefulShutdown = async (signal: string) => {
	await logger.insert("INSTANCE", "INFO", `Runtime received :signal, shutting down gracefully!`, { signal });

	const now = getNow();

	// DB: WORKERs: UPDATE
	await terminateInstanceWorkers(selfInstanceKey, signal);

	// DB: INSTANCE: UPDATE
	try {
		await database
			.table("instances")
			.where("key", selfInstanceKey)
			.update({
				specs: JSON.stringify(getInstanceSpecs()),
				status: "OFFLINE",
				updated_at: now,
				outcome: JSON.stringify({ message: "The instance has gone offline due to shutdown!", signal })
			});
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to update instance during shutdown!", { ...error });
	}

	await logger.insert("INSTANCE", "INFO", "Runtime shutdown completed!");

	process.exit(0);
};

async function init() {
	logger.setMetadata("INSTANCE", { instance_key: selfInstanceKey });
	await storage.config(config.storage);
	database.config(config.database);
	await database.verifySchemaExists();

	await logger.insert("INSTANCE", "INFO", "Starting runtime service...");

	try {
		const selfInstance = await database.table("instances").where("key", selfInstanceKey).first();
		await restartInstance(selfInstanceKey, selfInstance);

		await maintenanceLoop();
		await processJobs();
		await processNotificationsQueue();
		await cleanup();
	} catch (error: Error | any) {
		await logger.insert("INSTANCE", "ERROR", "Failed to start runtime service!", { ...error });
		throw error;
	}
}

init().catch((error: Error | any) => {
	// Final catch to avoid unhandled rejections
	logger.console("INSTANCE", "ERROR", "Runtime initialization failed!", { ...error });
});
