export interface Log {
	[key: string]: unknown;
	key: string;
	instance_key?: string | null;
	worker_key?: string | null;
	job_key?: string | null;
	output_key?: string | null;
	notification_key?: string | null;
	type?: string;
	message?: string;
	data?: Record<string, unknown> | null;
	metadata?: Record<string, unknown> | null;
	created_at: string;
}
