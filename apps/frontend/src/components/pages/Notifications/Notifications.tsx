import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import type { Notification } from "@/interfaces/notification";
import NotificationsTable from "./NotificationsTable.tsx";
import { SearchInput, LoadingSpinner, PageHeader, ErrorAlert } from "@/components";

interface PaginationInfo {
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	has_more?: boolean;
	next_page?: number | null;
	prev_page?: number | null;
}

const Notifications: React.FC = () => {
	const { authToken } = useAuth();
	const queryClient = useQueryClient();

	// states
	const [searchQuery, setSearchQuery] = useState("");
	const [searchInput, setSearchInput] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [currentLimit, setCurrentLimit] = useState(25);
	const [statusFilter, setStatusFilter] = useState<string>("");
	const previousDataRef = useRef<Notification[]>([]);
	const [newNotificationKeys, setNewNotificationKeys] = useState<Set<string>>(new Set());

	// queries
	const {
		data: notificationsResponse,
		isLoading,
		error,
		dataUpdatedAt
	} = useQuery<ApiResponse<Notification[]>>({
		queryKey: ["notifications", currentPage, currentLimit, searchQuery, statusFilter, authToken],
		queryFn: () =>
			api.get<Notification[]>("/jobs/notifications", {
				token: authToken || "",
				page: currentPage,
				limit: currentLimit,
				...(searchQuery && { q: searchQuery }),
				...(statusFilter && { status: statusFilter })
			}),
		enabled: !!authToken,
		refetchInterval: 5000, // 5 saniyede bir otomatik refresh
		placeholderData: (previousData) => previousData
	});

	// actions
	const handleClearSearch = () => {
		setSearchInput("");
	};

	const handlePageChange = (newPage: number) => {
		setCurrentPage(newPage);
	};

	const handleLimitChange = (newLimit: number) => {
		setCurrentLimit(newLimit);
		setCurrentPage(1);
	};

	const handleRefresh = () => {
		queryClient.invalidateQueries({ queryKey: ["notifications"] });
	};

	const handleStatusFilterChange = (status: string) => {
		setStatusFilter(status);
		setCurrentPage(1);
	};

	// effects
	useEffect(() => {
		// Only detect new notifications on first page
		if (!notificationsResponse?.data || currentPage !== 1) {
			return;
		}

		const currentNotifications = notificationsResponse.data;
		const previousNotifications = previousDataRef.current;

		// Skip first load
		if (previousNotifications.length === 0) {
			previousDataRef.current = currentNotifications;
			return;
		}

		// Find new notifications by comparing keys
		const previousKeys = new Set(previousNotifications.map((n) => n.key));
		const newKeys = currentNotifications
			.filter((notification) => !previousKeys.has(notification.key))
			.map((notification) => notification.key);

		if (newKeys.length > 0) {
			setNewNotificationKeys(new Set(newKeys));
			// Clear animation after 2 seconds
			const timer = setTimeout(() => {
				setNewNotificationKeys(new Set());
			}, 2000);

			// Update ref
			previousDataRef.current = currentNotifications;

			return () => clearTimeout(timer);
		}

		previousDataRef.current = currentNotifications;
	}, [dataUpdatedAt, currentPage]); // Removed notificationsResponse from deps - dataUpdatedAt is enough

	useEffect(() => {
		const timer = setTimeout(() => {
			setSearchQuery(searchInput);
		}, 500);

		return () => clearTimeout(timer);
	}, [searchInput]);

	useEffect(() => {
		if (searchQuery !== "") {
			setCurrentPage(1);
		}
	}, [searchQuery]);

	// Prepare pagination data
	const pagination: PaginationInfo = {
		total: notificationsResponse?.pagination?.total || 0,
		page: notificationsResponse?.pagination?.page || 1,
		limit: notificationsResponse?.pagination?.limit || 25,
		totalPages: notificationsResponse?.pagination?.total_pages || 0,
		has_more: notificationsResponse?.pagination?.has_more,
		next_page: notificationsResponse?.pagination?.next_page,
		prev_page: notificationsResponse?.pagination?.prev_page
	};

	// renders
	if (isLoading && !notificationsResponse) {
		return <LoadingSpinner />;
	}

	return (
		<div className="space-y-6">
			<PageHeader
				title="Notifications"
				onRefresh={handleRefresh}
				isRefreshing={isLoading}>
				{/* Status Filter */}
				<select
					value={statusFilter}
					onChange={(e) => handleStatusFilterChange(e.target.value)}
					className="h-[38px] px-3 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 sm:text-sm">
					<option value="">All Status</option>
					<option value="PENDING">PENDING</option>
					<option value="SUCCESSFUL">SUCCESSFUL</option>
					<option value="FAILED">FAILED</option>
					<option value="SKIPPED">SKIPPED</option>
				</select>

				<SearchInput
					value={searchInput}
					onChange={setSearchInput}
					onClear={handleClearSearch}
					placeholder="Search notifications..."
					className="h-[38px]"
				/>
			</PageHeader>{" "}
			<ErrorAlert error={error} />
			{/* Table */}
			<div className="bg-gray-100 dark:bg-neutral-800 shadow-md rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700">
				<NotificationsTable
					data={notificationsResponse?.data || []}
					loading={isLoading}
					pagination={{
						total: pagination.total,
						page: pagination.page,
						limit: pagination.limit,
						totalPages: pagination.totalPages,
						has_more: pagination.has_more,
						next_page: pagination.next_page,
						prev_page: pagination.prev_page
					}}
					onPageChange={handlePageChange}
					onLimitChange={handleLimitChange}
					newNotificationKeys={newNotificationKeys}
				/>
			</div>
			{/* Nested Route Outlet for NotificationDetailModal */}
			<Outlet />
		</div>
	);
};

export default Notifications;
