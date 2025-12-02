import { database } from "@voltage/utils";

export const getWorker = async (worker_key: string) => {
	const worker = await database.table("instances_workers").where("key", worker_key).first();

	if (!worker) {
		throw new Error("NOT_FOUND");
	}

	return worker;
};

export const getWorkers = async (instance_key?: string) => {
	const query = database.table("instances_workers");
	if (instance_key) query.where("instance_key", instance_key);
	const workers = await query.orderBy("index", "asc");

	return workers;
};

export const deleteWorkers = async (params: { all?: boolean; instance_key?: string; worker_key?: string }) => {
	if (params.all) {
		await database.table("instances_workers").delete();
		return { message: "All workers successfully deleted!" };
	}

	if (!params.instance_key || !params.worker_key) {
		throw new Error("No instance_key or worker_key provided to delete!");
	}

	const query = database.table("instances_workers");

	if (params.instance_key) query.where("instance_key", params.instance_key);
	if (params.worker_key) query.where("key", params.worker_key);

	await query.delete();

	return { message: "Workers successfully deleted!" };
};
