export interface PaginationInfo {
	total: number;
	page: number;
	limit: number;
	total_pages: number;
	has_more?: boolean;
	next_page?: number | null;
	prev_page?: number | null;
}
