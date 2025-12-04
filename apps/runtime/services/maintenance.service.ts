import { config } from "@voltage/config";
import { database, logger, getInstanceKey, getNow, subtractNow } from "@voltage/utils";
import { initInstance, maintainInstance, getMasterInstance, setMasterInstance } from "@/services/instances.service.js";
import { timeoutBusyWorkers, idleTimeoutWorkers, terminateInactiveInstanceWorkers } from "@/services/workers.service.js";

const selfInstanceKey = getInstanceKey();

export const maintainInstancesAndWorkers = async (): Promise<void> => {
	logger.console("INFO", "Maintaining instances and workers...");

	const now = getNow();
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
		const timeoutedWorkerKeys = await timeoutBusyWorkers();

		// INSTANCEs: WORKERs: UPDATE: IDLE
		await idleTimeoutWorkers();

		logger.console("INFO", "Maintaining instances...");

		// INSTANCEs: UPDATE: OFFLINE
		try {
			const offlineTimeout = config.runtime.online_timeout || 1 * 15 * 1000; // in milliseconds, default 15 seconds

			const inactiveInstances = await database
				.table("instances")
				.where("status", "ONLINE")
				.where("updated_at", "<=", subtractNow(offlineTimeout, "milliseconds"))
				.select("key");

			const inactiveInstanceKeys = inactiveInstances.map((r: any) => r.key).filter(Boolean);

			if (inactiveInstanceKeys.length > 0) {
				await terminateInactiveInstanceWorkers(inactiveInstanceKeys);

				// cpu_usage_percent, memory_usage_percent

				await database
					.table("instances")
					.whereIn("key", inactiveInstanceKeys)
					.update({
						outcome: JSON.stringify({
							message: "The instance has gone offline because it has not been updated for a long time!"
						}),
						status: "OFFLINE",
						updated_at: now
					});
			}
		} catch (error: Error | any) {
			await logger.insert("ERROR", "Unable to take offline instances that were not updated!", { ...error });
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
			await logger.insert("ERROR", "Purging offline instances failed!", { ...error });
		}
	}
};
