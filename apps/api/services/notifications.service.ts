import { database } from "@voltage/utils";
import { getDate, getNow } from "@voltage/utils";
import { PaginationParams } from "@/types/index.js";

export const getNotification = async (notification_key: string) => {
	const notification = await database.table("jobs_notifications").where("key", notification_key).first();

	if (!notification) {
		throw new Error("NOT_FOUND");
	}

	return notification;
};

export const getNotifications = async (
	pagination: PaginationParams,
	filters: {
		instance_key?: string;
		worker_key?: string;
		job_key?: string;
		status?: string;
		q?: string;
	}
) => {
	let query = database.table("jobs_notifications");

	if (filters.instance_key) query = query.where("instance_key", filters.instance_key);
	if (filters.worker_key) query = query.where("worker_key", filters.worker_key);
	if (filters.job_key) query = query.where("job_key", filters.job_key);
	if (filters.status) query = query.where("status", filters.status);

	if (filters.q) {
		const searchPattern = `%${filters.q}%`;
		query = query.where(function () {
			this.where("key", "like", searchPattern)
				.orWhere("job_key", "like", searchPattern)
				.orWhere("instance_key", "like", searchPattern)
				.orWhere("worker_key", "like", searchPattern)
				.orWhere("specs", "like", searchPattern)
				.orWhere("payload", "like", searchPattern)
				.orWhere("outcome", "like", searchPattern)
				.orWhere("status", "like", searchPattern);
		});
	}

	const totalResult = await query.clone().count("* as total").first();
	const total = (totalResult as any).total;

	const notifications = await query.orderBy("created_at", "desc").limit(pagination.limit).offset(pagination.offset);

	return { notifications, total };
};

export const retryNotification = async (notification_key: string) => {
	if (!notification_key) {
		throw new Error("KEY_REQUIRED");
	}

	const notification = await database.table("jobs_notifications").where("key", notification_key).first();

	if (!notification) {
		throw new Error("NOT_FOUND");
	}

	await database.table("jobs_notifications").where("key", notification_key).update({
		status: "PENDING",
		retry_at: getNow(),
		updated_at: getNow()
	});

	return { message: "Notification successfully rescheduled!" };
};

export const deleteNotifications = async (params: { all?: boolean; notification_key?: string; since_at?: string; until_at?: string }) => {
	if (params.all) {
		await database.table("jobs_notifications").delete();
		return { message: "All job notifications successfully deleted!" };
	}

	if (params.notification_key) {
		await database.table("jobs_notifications").where("key", params.notification_key).delete();
		return { message: "job notification successfully deleted!" };
	}

	let query = database.table("jobs_notifications");

	if (params.since_at) {
		const sinceDate = getDate(params.since_at, "YYYY-MM-DD");
		query = query.where("created_at", ">=", sinceDate);
	}

	if (params.until_at) {
		const untilDate = getDate(params.until_at, "YYYY-MM-DD");
		query = query.where("created_at", "<=", untilDate);
	}

	await query.delete();

	return {
		message: "Some job notifications successfully deleted!",
		since_at: params.since_at || null,
		until_at: params.until_at || null
	};
};
