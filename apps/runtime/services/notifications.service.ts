import { config } from "@voltage/config";
import { database, logger, getInstanceKey, getNow } from "@voltage/utils";
import { retryJobNotification } from "@/worker/notifier.js";

const selfInstanceKey = getInstanceKey();

export const processJobsNotifications = async (): Promise<void> => {
	const now = getNow();

	try {
		// JOBs: NOTIFICATIONs: QUEUE: LOCK
		await database
			.table("jobs_notifications_queue")
			// .where('try_count', '<', 'try_max')
			.where(function () {
				this.where("status", "PENDING").orWhere(function () {
					this.where("status", "RETRYING").where("retry_at", "<=", now);
				});
			})
			.where("locked_by", null)
			.orderBy("priority", "asc")
			.orderBy("created_at", "asc")
			.limit(config.jobs.notifications.process_limit || 10) // default 10
			.update({ locked_by: selfInstanceKey }); // updated_at: now,

		// JOBs: NOTIFICATIONs: QUEUE: SELECT LOCKEDs
		const pendingJobsNotifications = await database.table("jobs_notifications_queue").where("locked_by", selfInstanceKey);

		for (const pendingNotification of pendingJobsNotifications) {
			await retryJobNotification(pendingNotification);
		}

		// JOBs: QUEUEDs: RELEASE
		await database.table("jobs_notifications_queue").where("locked_by", selfInstanceKey).update({ locked_by: null });
	} catch (error: Error | any) {
		await logger.insert("ERROR", "Failed to process jobs notifications queue!", { ...error });
	}
};
