import { Outcome } from "@/interfaces/instance";

export interface NotificationPayload {
	status?: string;
	[key: string]: unknown;
}

export interface Notification {
	[key: string]: unknown;
	key: string;
	instance_key?: string | null;
	worker_key?: string | null;
	job_key?: string;
	type?: string;
	priority?: number;
	payload?: NotificationPayload | null;
	specs?: Record<string, unknown> | null;
	status?: "PENDING" | "SUCCESSFUL" | "SKIPPED" | "FAILED";
	try_max?: number;
	try_count?: number;
	retry_in?: number;
	retry_at?: string | null;
	outcome?: Outcome | null;
	updated_at: string;
	created_at: string;
}
