import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import type { Notification } from "@/interfaces/notification";
import NotificationsTable from "./NotificationsTable.tsx";
import Tooltip from "@/components/base/Tooltip/Tooltip";
import Button from "@/components/base/Button/Button";
import Alert from "@/components/base/Alert/Alert";
import { MagnifyingGlassIcon, XMarkIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

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

	// Fetch notifications with React Query
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
		refetchInterval: 5000 // 5 saniyede bir otomatik refresh
	});

	// Detect new notifications when data updates
	useEffect(() => {
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
	}, [dataUpdatedAt, notificationsResponse, currentPage]);

	// actions
	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		setSearchQuery(searchInput);
		setCurrentPage(1);
	};

	const handleClearSearch = () => {
		setSearchInput("");
		setSearchQuery("");
		setCurrentPage(1);
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
		return (
			<div className="flex justify-center items-center h-64">
				<div className="animate-spin rounded-full h-10 w-10 border-2 border-b-white border-gray-500 dark:border-gray-400"></div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header with Search */}
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<div className="flex items-center gap-3">
					<h3 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h3>
					<Tooltip content="Refresh notifications">
						<Button
							variant="ghost"
							size="md"
							iconOnly
							onClick={handleRefresh}
							disabled={isLoading}>
							<ArrowPathIcon className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
						</Button>
					</Tooltip>
				</div>
				<div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
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

					{/* Search Box */}
					<form
						onSubmit={handleSearch}
						className="flex gap-2 flex-1 sm:flex-initial">
						<div className="relative flex-1 sm:w-64">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
							</div>
							<input
								type="text"
								value={searchInput}
								onChange={(e) => setSearchInput(e.target.value)}
								placeholder="Search notifications..."
								className="block w-full h-[38px] pl-10 pr-10 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 sm:text-sm"
							/>
							{searchInput && (
								<button
									type="button"
									onClick={handleClearSearch}
									className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
									<XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
								</button>
							)}
						</div>
						<Tooltip content="Search notifications">
							<Button
								variant="soft"
								size="md"
								iconOnly
								type="submit">
								<MagnifyingGlassIcon className="h-5 w-5" />
							</Button>
						</Tooltip>
					</form>
				</div>
			</div>

			{/* Error Message */}
			{error && <Alert variant="error">{error instanceof Error ? error.message : "An error occurred"}</Alert>}

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
