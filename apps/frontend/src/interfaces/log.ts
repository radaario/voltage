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

export interface LogsResponse {
	data: Log[];
	pagination: {
		total: number;
		page: number;
		limit: number;
		total_pages: number;
		has_more?: boolean;
		next_page?: number | null;
		prev_page?: number | null;
	};
}
