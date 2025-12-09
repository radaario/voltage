// Pagination types
export interface PaginationParams {
	limit: number;
	page: number;
	offset: number;
}

export interface PaginationMeta {
	limit: number;
	page: number;
	total: number;
	total_pages: number;
	has_more: boolean;
	next_page: number | null;
	prev_page: number | null;
}

// API Response types
export interface ApiResponseMetadata {
	version: string;
	env: string;
	status: "SUCCESSFUL" | "ERROR";
	error?: {
		code: string;
		message: string;
	};
	[key: string]: any;
}

export interface ApiResponse<T = any> {
	metadata: ApiResponseMetadata;
	data?: T;
	message?: string;
	pagination?: PaginationMeta;
}

export interface ApiErrorResponse {
	metadata: ApiResponseMetadata & {
		status: "ERROR";
		error: {
			code: string;
			message: string;
		};
	};
}
