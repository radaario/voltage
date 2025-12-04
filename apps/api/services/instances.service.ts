import { database } from "@voltage/utils";

export const getInstance = async (instance_key: string) => {
	const instance = await database.table("instances").where("key", instance_key).first();

	if (!instance) {
		throw new Error("NOT_FOUND");
	}

	const workers = await database.table("instances_workers").where("instance_key", instance_key).orderBy("index", "asc");

	return {
		...instance,
		specs: instance.specs ? JSON.parse(instance.specs) : "{}",
		workers
	};
};

export const getInstances = async (q?: string) => {
	let query = database.table("instances");

	if (q) {
		const searchPattern = `%${q}%`;
		query = query.where(function () {
			this.where("key", "like", searchPattern)
				.orWhere("type", "like", searchPattern)
				.orWhere("specs", "like", searchPattern)
				.orWhere("outcome", "like", searchPattern)
				.orWhere("status", "like", searchPattern);
		});
	}

	const instances = await query
		.orderByRaw("CASE WHEN type = 'MASTER' THEN 0 ELSE 1 END")
		.orderByRaw("CASE WHEN status = 'ONLINE' THEN 0 ELSE 1 END");

	// If no instances, return empty array immediately
	if (instances.length === 0) {
		return [];
	}

	// Collect instance keys and fetch workers for those instances in one query
	const workers = await database.table("instances_workers").orderBy("index", "asc");

	const workersByInstance: Record<string, any[]> = {};
	for (const worker of workers) {
		if (!workersByInstance[worker.instance_key]) workersByInstance[worker.instance_key] = [];
		workersByInstance[worker.instance_key].push(worker);
	}

	// Parse instance.specs JSON and attach workers array to each instance
	const result = instances.map((instance: any) => {
		const newInstance = {
			...instance,
			specs: instance.specs ? JSON.parse(instance.specs) : "{}",
			workers: workersByInstance[instance.key] || []
		};

		if (newInstance.specs && newInstance.status !== "ONLINE") {
			newInstance.specs.cpu_usage_percent = 0.0;
			newInstance.specs.memory_free = newInstance.specs.memory_total;
			newInstance.specs.memory_usage_percent = 0.0;
		}

		return newInstance;
	});

	return result;
};

export const deleteInstances = async (params: { all?: boolean; instance_key?: string }) => {
	if (params.all) {
		await database.table("instances").delete();
		await database.table("instances_workers").delete();
		return { message: "All instances and workers successfully deleted!" };
	}

	if (!params.instance_key) {
		throw new Error("No instance_key provided to delete specific instance!");
	}

	await database.table("instances").where("key", params.instance_key).delete();
	await database.table("instances_workers").where("instance_key", params.instance_key).delete();

	return { message: "Instance successfully deleted!" };
};
