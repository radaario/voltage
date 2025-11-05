export interface Notification {
	key: string;
	instance_key?: string | null;
	worker_key?: string | null;
	job_key?: string;
	event?: string;
	priority?: number;
	payload?: any;
	status?: "PENDING" | "SUCCESSFUL" | "SKIPPED" | "FAILED";
	retry_max?: number;
	retry_count?: number;
	retry_in?: number;
	retry_at?: string | null;
	outcome?: any | null;
	updated_at: string;
	created_at: string;
}

export interface NotificationsResponse {
	data: Notification[];
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
