import { database, storage, logger } from "@voltage/utils";

export const deleteAllData = async () => {
	await database.table("stats").delete();
	await database.table("logs").delete();

	await database.table("instances").delete();
	await database.table("instances_workers").delete();

	try {
		await storage.delete(`/jobs`);
	} catch (error: Error | any) {}

	await database.table("jobs").delete();
	await database.table("jobs_queue").delete();
	await database.table("jobs_outputs").delete();
	await database.table("jobs_notifications").delete();
	await database.table("jobs_notifications_queue").delete();

	await logger.insert("WARNING", "All data deleted!");

	return { message: "All data successfully deleted!" };
};
