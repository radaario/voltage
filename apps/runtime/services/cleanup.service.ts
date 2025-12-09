import { config } from "@voltage/config";
import { database, logger, storage, subtractNow } from "@voltage/utils";

export const cleanupCompletedJobs = async (): Promise<void> => {
	if (config.jobs.retention > 0) {
		// JOBs: CLEANUP
		logger.console("INFO", "Cleaning up completed jobs...");

		const jobsToHardDelete = await database
			.table("jobs")
			.select("key")
			.where("status", "COMPLETED")
			.whereNotNull("completed_at")
			.where("completed_at", "<=", subtractNow(config.jobs.retention || 24 * 60 * 60 * 1000, "milliseconds")); // in milliseconds, default 24 hours

		const jobsKeysToHardDelete = jobsToHardDelete.map((r: any) => r.key);

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

			logger.console("INFO", "Jobs cleaning completed!", { count: jobsKeysToHardDelete.length });
		}
	}
};

export const cleanupStats = async (): Promise<void> => {
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
};

export const cleanupLogs = async (): Promise<void> => {
	// LOGS: CLEANUP
	if (!config.logs.is_disabled || (config.logs.retention || 60 * 60 * 1000) > 0) {
		// in milliseconds, default 1 hour
		logger.console("INFO", "Cleaning logs...");

		await database
			.table("logs")
			.where("created_at", "<=", subtractNow(config.logs.retention || 60 * 60 * 1000, "milliseconds"))
			.where("job_key", null) // do not delete job logs
			.delete(); // in milliseconds, default 1 hour

		logger.console("INFO", "Logs cleaning completed!");
	}
};
