import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/utils";
import type { Notification } from "@/interfaces/notification";
import { ArrowPathIcon, CheckCircleIcon, XCircleIcon, ClockIcon, MinusCircleIcon } from "@heroicons/react/24/outline";

interface NotificationsTableProps {
	notifications: Notification[];
	isLoading: boolean;
	pagination?: {
		total: number;
		page: number;
		limit: number;
		total_pages: number;
		has_more?: boolean;
		next_page?: number | null;
		prev_page?: number | null;
	};
	currentPage: number;
	setCurrentPage: (page: number) => void;
	currentLimit: number;
	setCurrentLimit: (limit: number) => void;
}

const NotificationsTable: React.FC<NotificationsTableProps> = ({
	notifications,
	isLoading,
	pagination,
	currentPage,
	setCurrentPage,
	currentLimit,
	setCurrentLimit
}) => {
	const { authToken } = useAuth();
	const queryClient = useQueryClient();
	const [retryingKey, setRetryingKey] = useState<string | null>(null);

	// Retry notification mutation
	const retryNotificationMutation = useMutation({
		mutationFn: async (notificationKey: string) => {
			const params = new URLSearchParams();
			params.append("token", authToken || "");
			params.append("notification_key", notificationKey);

			const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/jobs/notifications/retry?${params}`, {
				method: "POST"
			});
			if (!response.ok) {
				throw new Error("Failed to retry notification");
			}
			return await response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["notifications"] });
			setRetryingKey(null);
		},
		onError: () => {
			setRetryingKey(null);
		}
	});

	const handleRetryNotification = (notificationKey: string) => {
		if (window.confirm("Are you sure you want to retry this notification?")) {
			setRetryingKey(notificationKey);
			retryNotificationMutation.mutate(notificationKey);
		}
	};

	const getStatusColor = (status?: string) => {
		switch (status) {
			case "SUCCESSFUL":
				return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
			case "FAILED":
				return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
			case "PENDING":
				return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
			case "SKIPPED":
				return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
			default:
				return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
		}
	};

	const getStatusIcon = (status?: string) => {
		switch (status) {
			case "SUCCESSFUL":
				return <CheckCircleIcon className="w-4 h-4" />;
			case "FAILED":
				return <XCircleIcon className="w-4 h-4" />;
			case "PENDING":
				return <ClockIcon className="w-4 h-4" />;
			case "SKIPPED":
				return <MinusCircleIcon className="w-4 h-4" />;
			default:
				return <ClockIcon className="w-4 h-4" />;
		}
	};

	const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const newLimit = parseInt(e.target.value);
		setCurrentLimit(newLimit);
		setCurrentPage(1);
	};

	if (isLoading) {
		return (
			<div className="flex justify-center items-center py-12">
				<div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-500 dark:border-gray-400 border-t-transparent"></div>
			</div>
		);
	}

	if (notifications.length === 0) {
		return (
			<div className="text-center py-12">
				<p className="text-gray-600 dark:text-gray-400">No notifications found.</p>
			</div>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className="w-full">
				<thead className="bg-gray-50 dark:bg-neutral-700 border-b border-gray-200 dark:border-neutral-600">
					<tr>
						<th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
							Event
						</th>
						<th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
							Job Key
						</th>
						<th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
							Status
						</th>
						<th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
							Retry
						</th>
						<th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
							Priority
						</th>
						<th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
							Created
						</th>
						<th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
							Actions
						</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
					{notifications.map((notification) => (
						<tr
							key={notification.key}
							className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
							<td className="px-6 py-4">
								<span className="font-medium text-gray-900 dark:text-gray-100">{notification.event || "UNKNOWN"}</span>
							</td>
							<td className="px-6 py-4">
								<span className="font-mono text-xs text-gray-600 dark:text-gray-400">{notification.job_key || "-"}</span>
							</td>
							<td className="px-6 py-4">
								<div className="flex items-center gap-2">
									<span
										className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(notification.status)}`}>
										{getStatusIcon(notification.status)}
										{notification.status || "PENDING"}
									</span>
								</div>
							</td>
							<td className="px-6 py-4">
								<span className="text-sm text-gray-600 dark:text-gray-400">
									{notification.retry_count || 0} / {notification.retry_max || 0}
								</span>
							</td>
							<td className="px-6 py-4">
								<span className="text-sm text-gray-600 dark:text-gray-400">{notification.priority || 1000}</span>
							</td>
							<td className="px-6 py-4 whitespace-nowrap">
								<span className="text-sm text-gray-600 dark:text-gray-400">{formatDate(notification.created_at)}</span>
							</td>
							<td className="px-6 py-4">
								{notification.status === "FAILED" && (
									<button
										onClick={() => handleRetryNotification(notification.key)}
										disabled={retryingKey === notification.key}
										className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-xs font-medium transition-colors">
										<ArrowPathIcon className={`w-3 h-3 ${retryingKey === notification.key ? "animate-spin" : ""}`} />
										{retryingKey === notification.key ? "Retrying..." : "Retry"}
									</button>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>

			{/* Pagination */}
			{pagination && (
				<div className="bg-gray-50 dark:bg-neutral-700 px-6 py-4 border-t border-gray-200 dark:border-neutral-600">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<div className="text-sm text-gray-700 dark:text-gray-300">
								Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
								{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} notifications
							</div>
							<div className="flex items-center gap-2">
								<label
									htmlFor="limit"
									className="text-sm text-gray-700 dark:text-gray-300">
									Per page:
								</label>
								<select
									id="limit"
									value={currentLimit}
									onChange={handleLimitChange}
									className="px-3 py-1 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 dark:focus:ring-neutral-400">
									<option value="10">10</option>
									<option value="25">25</option>
									<option value="50">50</option>
									<option value="100">100</option>
								</select>
							</div>
						</div>
						<div className="flex gap-2">
							<button
								onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
								disabled={currentPage === 1}
								className="px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors font-medium text-sm">
								Previous
							</button>
							<div className="flex items-center px-4 py-2 bg-gray-100 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-600 rounded-lg">
								<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
									Page {pagination.page} of {pagination.total_pages}
								</span>
							</div>
							<button
								onClick={() => setCurrentPage(Math.min(pagination.total_pages, currentPage + 1))}
								disabled={currentPage === pagination.total_pages}
								className="px-4 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors font-medium text-sm">
								Next
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default NotificationsTable;
