import { database, logger } from "@voltage/utils";
import { getDate } from "@voltage/utils";
import { PaginationParams } from "@/types/index.js";

export const getLog = async (log_key: string) => {
	const log = await database.table("logs").where("key", log_key).first();

	if (!log) {
		throw new Error("NOT_FOUND");
	}

	return log;
};

export const getLogs = async (
	pagination: PaginationParams,
	filters: {
		instance_key?: string;
		worker_key?: string;
		job_key?: string;
		output_key?: string;
		notification_key?: string;
		type?: string;
		q?: string;
	}
) => {
	let query = database.table("logs");

	if (filters.type) query = query.where("type", filters.type);
	if (filters.instance_key) query = query.where("instance_key", filters.instance_key);
	if (filters.worker_key) query = query.where("worker_key", filters.worker_key);
	if (filters.job_key) query = query.where("job_key", filters.job_key);
	if (filters.output_key) query = query.where("output_key", filters.output_key);
	if (filters.notification_key) query = query.where("notification_key", filters.notification_key);

	if (filters.q) {
		const searchPattern = `%${filters.q}%`;
		query = query.where(function () {
			this.where("key", "like", searchPattern)
				.orWhere("type", "like", searchPattern)
				.orWhere("instance_key", "like", searchPattern)
				.orWhere("worker_key", "like", searchPattern)
				.orWhere("job_key", "like", searchPattern)
				.orWhere("output_key", "like", searchPattern)
				.orWhere("notification_key", "like", searchPattern)
				.orWhere("message", "like", searchPattern)
				.orWhere("metadata", "like", searchPattern);
		});
	}

	// Get total count for pagination metadata
	const totalResult = await query.clone().count("* as total").first();
	const total = (totalResult as any).total;

	// Get paginated data
	const logs = await query.orderBy("created_at", "desc").limit(pagination.limit).offset(pagination.offset);

	return { logs, total };
};

export const deleteLogs = async (params: { all?: boolean; log_key?: string; since_at?: string; until_at?: string }) => {
	if (params.all) {
		await database.table("logs").delete();
		await logger.insert("API", "WARNING", "All logs successfully deleted!");
		return { message: "All logs successfully deleted!" };
	}

	if (params.log_key) {
		await database.table("logs").where("key", params.log_key).delete();
		await logger.insert("API", "WARNING", "Log successfully deleted!", { ...params });
		return { message: "Log successfully deleted!" };
	}

	let query = database.table("logs");

	if (params.since_at) {
		const sinceDate = getDate(params.since_at, "YYYY-MM-DD");
		query = query.where("created_at", ">=", sinceDate);
	}

	if (params.until_at) {
		const untilDate = getDate(params.until_at, "YYYY-MM-DD");
		query = query.where("created_at", "<=", untilDate);
	}

	await query.delete();

	await logger.insert("API", "WARNING", "Some logs successfully deleted!", { ...params });

	return {
		message: "Some logs successfully deleted!",
		since_at: params.since_at || null,
		until_at: params.until_at || null
	};
};
