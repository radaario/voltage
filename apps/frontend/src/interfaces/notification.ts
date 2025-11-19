export interface Notification {
	key: string;
	instance_key?: string | null;
	worker_key?: string | null;
	job_key?: string;
	type?: string;
	priority?: number;
	payload?: any;
	specs?: any;
	status?: "PENDING" | "SUCCESSFUL" | "SKIPPED" | "FAILED";
	try_max?: number;
	try_count?: number;
	retry_in?: number;
	retry_at?: string | null;
	outcome?: any | null;
	updated_at: string;
	created_at: string;
}
