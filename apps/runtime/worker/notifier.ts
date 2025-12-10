import { config } from "@voltage/config";
import { JobNotificationSpecs } from "@voltage/config/types";

import { database, stats, logger } from "@voltage/utils";
import { uukey, getNow, addNow, sanitizeData } from "@voltage/utils";

import axios from "axios";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

database.config(config.database);

export async function createJobNotification(job: any, jobStatus: string): Promise<any> {
	if (!job.notification || !job.notification.type) {
		return { status: "SKIPPED" };
	}

	let jobNotificationNotifyOn = config.jobs.notifications.notify_on ? config.jobs.notifications.notify_on.split(",") : [];
	if (job.notification && job.notification.notify_on && Array.isArray(job.notification.notify_on)) {
		jobNotificationNotifyOn = job.notification.notify_on;
	}

	if (jobNotificationNotifyOn && !jobNotificationNotifyOn.includes(jobStatus)) {
		return { status: "SKIPPED" };
	}

	logger.setMetadata("NOTIFIER", { instance_key: job.instance_key, worker_key: job.worker_key, job_key: job.key });

	let outcome: any = {
		status: "FAILED"
	};

	const sanitizedJob = sanitizeData({ ...job, status: jobStatus });
	const now = getNow();

	const notificationOutcome = await notify(job.notification, sanitizedJob);

	let notification: any = {
		key: uukey(),
		instance_key: job.instance_key,
		worker_key: job.worker_key,
		job_key: job.key,
		priority: job.priority ?? 1000,
		specs: job.notification || null,
		payload: sanitizedJob || null,
		outcome: notificationOutcome || null,
		status: notificationOutcome.status || "FAILED",
		updated_at: now,
		created_at: now,
		try_max: config.jobs.notifications.try || 3, // default 3
		try_count: 1,
		retry_in: config.jobs.notifications.retry_in || 1 * 60 * 1000, // in milliseconds, default 1 minute
		retry_at: null
	};

	if (job?.notification?.try && parseInt(job.notification.try) > 0) notification.try_max = parseInt(job.notification.try);
	if (notification.try_max < 1) notification.try_max = 1;
	if (notification.try_max > config.jobs.notifications.try_max) notification.try_max = config.jobs.notifications.try_max;

	if (job.notification?.retry_in && parseInt(job.notification.retry_in) > 0) notification.retry_in = parseInt(job.notification.retry_in);
	if (notification.retry_in < 1 * 1000) notification.retry_in = 1 * 1000;
	if (notification.retry_in > config.jobs.notifications.retry_in_max) notification.retry_in = config.jobs.notifications.retry_in_max;

	const notificationStats = {
		notifications_created_count: 1,
		notifications_sent_count: 0,
		notifications_retried_count: 0,
		notifications_failed_count: 0
	};

	if (notification.status === "SUCCESSFUL") {
		notificationStats.notifications_sent_count = 1;
		/* ! */
	} else if (notification.status === "FAILED") {
		if (notification.try_count < notification.try_max) {
			notification.status = "RETRYING";
			notification.retry_at = addNow(notification.retry_in, "milliseconds");

			// JOB: NOTIFICATION: QUEUE: INSERT
			await database.table("jobs_notifications_queue").insert(notification); // .onConflict('key').merge();

			notificationStats.notifications_retried_count = 1;
		} else {
			notificationStats.notifications_failed_count = 1;
			/* ! */
		}
	}

	if (["SUCCESSFUL", "FAILED"].includes(notification.status)) {
		try {
			// JOB: NOTIFICATION: QUEUE: DELETE
			// await database.table('jobs_notifications_queue').where('key', notification.key).delete();
			// await database.table('jobs_notifications').where('job_key', notification.job_key).whereIn('status', ['PENDING', 'RETRYING']).update({status: 'SKIPPED'});
		} catch (error: Error | any) {}
	}

	try {
		// JOB: NOTIFICATION: INSERT
		await database.table("jobs_notifications").insert({
			...notification,
			specs: notification.specs ? JSON.stringify(notification.specs) : null,
			payload: notification.payload ? JSON.stringify(notification.payload) : null,
			outcome: notification.outcome ? JSON.stringify(notification.outcome) : null
		});

		return notificationOutcome;
	} catch (error: Error | any) {
		logger.console("NOTIFIER", "ERROR", "Failed to create job notification record!", { notification_key: notification.key, ...error });
		outcome = { status: "FAILED", error: { message: error.message || "Unknown error occurred!" } }; // , outcome: notificationOutcome
		notificationStats.notifications_failed_count = 1;
	}

	await stats.update(notificationStats);

	return outcome;
}

export async function retryJobNotification(notification: any): Promise<any> {
	logger.setMetadata("NOTIFIER", {
		instance_key: notification.instance_key,
		worker_key: notification.worker_key,
		job_key: notification.job_key
	});

	logger.console("NOTIFIER", "INFO", "Retrying job notification...", { notification_key: notification.key });

	let outcome: any = {
		status: "FAILED"
	};

	const notificationStats = {
		notifications_retried_count: 0,
		notifications_sent_count: 0,
		notifications_failed_count: 0
	};

	try {
		const notificationOutcome = await notify(JSON.parse(notification.specs), JSON.parse(notification.payload));

		notification.status = notificationOutcome.status || "FAILED";
		notification.try_count = (notification.try_count || 1) + 1;
		notification.updated_at = getNow();
		notification.outcome = notificationOutcome;
		notification.retry_at = null;

		if (notification.status === "SUCCESSFUL") {
			notificationStats.notifications_sent_count = 1;
			/* ! */
		} else if (notification.status === "FAILED") {
			if (notification.try_count < notification.try_max) {
				notification.status = "RETRYING";
				notification.retry_at = addNow(notification.retry_in, "milliseconds");

				// JOB: NOTIFICATION: QUEUE: UPDATE OR INSERT
				try {
					await database.table("jobs_notifications_queue").insert(notification).onConflict("key").merge();
				} catch (error: Error | any) {
					// console.log("ERROR", error);
				}

				notificationStats.notifications_retried_count = 1;
			} else {
				notificationStats.notifications_failed_count = 1;
				/* ! */
			}
		}

		if (["SUCCESSFUL", "FAILED"].includes(notification.status)) {
			try {
				// JOB: NOTIFICATION: QUEUE: DELETE
				await database.table("jobs_notifications_queue").where("key", notification.key).delete();
				// await database.table('jobs_notifications').where('job_key', notification.job_key).whereIn('status', ['PENDING', 'RETRYING']).update({ status: 'SKIPPED' });
			} catch (error: Error | any) {}
		}

		// JOB: NOTIFICATION: UPDATE
		await database
			.table("jobs_notifications")
			.where("key", notification.key)
			.update({
				...notification,
				specs: notification.specs ? JSON.stringify(notification.specs) : null,
				payload: notification.payload ? JSON.stringify(notification.payload) : null,
				outcome: notification.outcome ? JSON.stringify(notification.outcome) : null
			});

		if (notificationOutcome.status === "SUCCESSFUL") {
			outcome = { status: "SUCCESSFUL" };
		} else {
			outcome.error = { message: notificationOutcome.error?.message || "Unknown error occurred!" };
		}
	} catch (error: Error | any) {
		logger.console("NOTIFIER", "ERROR", "Failed to retry job notification!", { notification_key: notification.key, ...error });
		outcome.error = { message: error.message || "Unknown error occurred!" };
		notificationStats.notifications_failed_count = 1;
	}

	await stats.update(notificationStats);

	return outcome;
}

export async function notify(specs: JobNotificationSpecs, payload: any): Promise<any> {
	let outcome: any = {
		status: "FAILED"
	};

	try {
		if (specs.type === "HTTP" || specs.type === "HTTPS") {
			// HTTP/HTTPS notification
			outcome = await notifyHttp(specs, payload);
		} else if (specs.type === "AWS_SNS") {
			// AWS SNS notification
			outcome = await notifySns(specs, payload);
		} else {
			throw new Error("Unknown notification type!");
		}
	} catch (error: Error | any) {
		logger.console("NOTIFIER", "WARNING", "Notification couldn't be sent!", { ...error });
		outcome.error = { message: error.message || "Unknown error occurred!" };
	}

	return outcome;
}

async function notifyHttp(specs: any, payload: any): Promise<any> {
	const method = specs.method || "POST";
	const headers = { "Content-Type": "application/json", "User-Agent": `${config.name}/${config.version}`, ...(specs.headers || {}) };

	let timeout = specs.timeout || config.jobs.notifications.timeout;
	if (timeout < 1) timeout = 1;
	if (timeout > config.jobs.notifications.timeout_max) timeout = config.jobs.notifications.timeout_max;

	const requestConfig: any = {
		method,
		headers,
		timeout
	};

	if (method === "GET") {
		// For GET requests, append payload as query parameters
		const params = new URLSearchParams();
		Object.entries(payload as any).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				params.append(key, String(value));
			}
		});
		requestConfig.url = `${specs.url}?${params.toString()}`;
	} else {
		// For POST/PUT requests, send as JSON body
		requestConfig.url = specs.url;
		requestConfig.data = payload;
	}

	const response = await axios.request(requestConfig);

	let outcome: any = {
		status: response.status === 200 ? "SUCCESSFUL" : "FAILED",
		http_status_code: response.status
	};

	if (response.status !== 200) outcome.error = { message: response.statusText || "Unknown error occurred!" };
	if (response.headers) outcome.header = response.headers;
	if (response.data) outcome.body = response.data;

	return outcome;
}

async function notifySns(specs: any, payload: any): Promise<any> {
	const snsClient = new SNSClient({
		region: specs.region,
		credentials: {
			accessKeyId: specs.access_key,
			secretAccessKey: specs.access_secret
		}
	});

	// Always include full payload with metadata
	const command = new PublishCommand({
		TopicArn: specs.topic,
		Message: JSON.stringify(payload),
		Subject: `Job ${(payload as any)?.status || "update"}`
	});

	const response = await snsClient.send(command);

	let outcome: any = {
		status: response.$metadata.httpStatusCode === 200 ? "SUCCESSFUL" : "FAILED",
		http_status_code: response.$metadata.httpStatusCode
	};

	if (response.$metadata.httpStatusCode !== 200) outcome.error = { message: "Unknown error occurred!" }; // response.$metadata?.httpStatusText
	if (response.MessageId) outcome.message_id = response.MessageId;

	return outcome;
}
