import { config } from "@voltage/config";
import { database, logger, getInstanceKey, getInstanceSpecs, getNow } from "@voltage/utils";
import { Instance } from "@/types/index.js";

const selfInstanceKey = getInstanceKey();

export const initInstance = async (instanceKey: string, instance: any = null): Promise<any> => {
	await logger.insert("INFO", `Initializing instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""}...`);

	const now = getNow();

	try {
		if (!instance) {
			// INSTANCE: INSERT
			await database.table("instances").insert({
				key: instanceKey,
				specs: JSON.stringify(getInstanceSpecs()),
				status: "ONLINE",
				updated_at: now,
				created_at: now
			});

			await logger.insert("INFO", `Instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""} created!`);

			const { maintainInstanceWorkers } = await import("./workers.service.js");
			await maintainInstanceWorkers(instanceKey);

			return await database.table("instances").where("key", instanceKey).first();
		}

		// INSTANCE: UPDATE
		instance = await restartInstance(instanceKey, instance);
		return instance;
	} catch (error: Error | any) {
		await logger.insert("ERROR", `Instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""} initialization failed!`, {
			...error
		});
	}
};

export const restartInstance = async (instanceKey: string, instance: any): Promise<any> => {
	if (!instance) return null;

	await logger.insert("INFO", `Restarting instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""}...`);

	try {
		instance.restart_count = (instance.restart_count || 0) + 1;

		await database
			.table("instances")
			.where("key", instanceKey)
			.update({
				specs: JSON.stringify(getInstanceSpecs()),
				outcome: null,
				status: "ONLINE",
				updated_at: getNow(),
				restart_count: database.knex.raw("restart_count + 1")
			})
			.then(async (result) => {
				await logger.insert(
					"WARNING",
					`Instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""} restarted (${instance.restart_count} times)!`
				);
			});

		const { maintainInstanceWorkers } = await import("./workers.service.js");
		await maintainInstanceWorkers(instanceKey);

		return instance;
	} catch (error: Error | any) {}
};

export const maintainInstance = async (instanceKey: string): Promise<void> => {
	logger.console("INFO", `Maintaining instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""}...`);

	const now = getNow();

	try {
		// INSTACE: UPDATE
		await database
			.table("instances")
			.where("key", instanceKey)
			.update({
				specs: JSON.stringify(getInstanceSpecs()),
				status: "ONLINE",
				updated_at: now
			});

		// INSTANCE: WORKERs: UPDATE
		await database.table("instances_workers").where("instance_key", instanceKey).where("status", "IDLE").update({ updated_at: now });

		logger.console("INFO", `Instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""} successfully maintained!`);
	} catch (error: Error | any) {
		await logger.insert("ERROR", `Instance${instanceKey !== selfInstanceKey ? " (" + instanceKey + ")" : ""} maintenance failed!`, {
			...error
		});
	}
};

export const getMasterInstance = async (instances: any[]): Promise<any | null> => {
	try {
		if (!instances.length) {
			logger.console("ERROR", "No instances found!");
			return null;
		}

		const offlineTimeout = config.runtime.online_timeout || 1 * 15 * 1000; // in milliseconds, default 15 seconds
		const { subtractNow } = await import("@voltage/utils");

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
};

export const setMasterInstance = async (instanceKey: string): Promise<void> => {
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
};
