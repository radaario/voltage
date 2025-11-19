export interface Log {
	key: string;
	instance_key?: string | null;
	worker_key?: string | null;
	job_key?: string | null;
	output_key?: string | null;
	notification_key?: string | null;
	type?: string;
	message?: string;
	data?: any;
	metadata?: any;
	created_at: string;
}
