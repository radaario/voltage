import { database, storage, logger } from "@voltage/utils";

export const deleteAllData = async () => {
	await database.table("stats").delete();
	await database.table("logs").delete();

	await database.table("instances").delete();
	await database.table("instances_workers").delete();

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
	}

	await logger.insert("INFO", "All data deleted!");

	return { message: "All data successfully deleted!" };
};
