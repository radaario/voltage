import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/utils";
import type { Job } from "@/interfaces/job";
import type { NotificationsResponse } from "@/interfaces/notification";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

interface OutletContext {
	job: Job;
}

const NotificationsTab: React.FC = () => {
	const { job } = useOutletContext<OutletContext>();
	const { authToken } = useAuth();
	const queryClient = useQueryClient();
	const [currentPage, setCurrentPage] = useState(1);
	const [currentLimit] = useState(25);

	// Fetch notifications
	const { data, isLoading } = useQuery<NotificationsResponse>({
		queryKey: ["notifications", job.key, currentPage, currentLimit],
		queryFn: async () => {
			const params = new URLSearchParams();
			params.append("token", authToken || "");
			params.append("job_key", job.key);
			params.append("page", String(currentPage));
			params.append("limit", String(currentLimit));

			const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/jobs/notifications?${params}`);
			if (!response.ok) {
				throw new Error("Failed to fetch notifications");
			}
			return await response.json();
		},
		enabled: !!job.key && !!authToken
	});

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
			queryClient.invalidateQueries({ queryKey: ["notifications", job.key] });
		}
	});

	const handleRetryNotification = (notificationKey: string) => {
		if (window.confirm("Are you sure you want to retry this notification?")) {
			retryNotificationMutation.mutate(notificationKey);
		}
	};

	const notifications = data?.data || [];
	const pagination = data?.pagination;

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

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h4 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h4>
			</div>

			{isLoading ? (
				<div className="flex justify-center items-center py-12">
					<div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-500 dark:border-gray-400 border-t-transparent"></div>
				</div>
			) : notifications.length === 0 ? (
				<div className="text-center py-12">
					<p className="text-sm text-gray-600 dark:text-gray-400">No notifications found for this job.</p>
				</div>
			) : (
				<>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="bg-gray-50 dark:bg-neutral-700">
								<tr>
									<th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
										Event
									</th>
									<th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
										Status
									</th>
									<th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
										Retry
									</th>
									<th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
										Time
									</th>
									<th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
								{notifications.map((notification) => (
									<tr
										key={notification.key}
										className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
										<td className="px-4 py-3">
											<span className="font-medium text-gray-900 dark:text-gray-100">
												{notification.event || "UNKNOWN"}
											</span>
										</td>
										<td className="px-4 py-3">
											<span
												className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(notification.status)}`}>
												{notification.status || "PENDING"}
											</span>
										</td>
										<td className="px-4 py-3 text-gray-600 dark:text-gray-400">
											{notification.retry_count || 0} / {notification.retry_max || 0}
										</td>
										<td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
											{formatDate(notification.created_at)}
										</td>
										<td className="px-4 py-3">
											{notification.status === "FAILED" && (
												<button
													onClick={() => handleRetryNotification(notification.key)}
													disabled={retryNotificationMutation.isPending}
													className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded text-xs font-medium transition-colors">
													<ArrowPathIcon className="w-3 h-3" />
													Retry
												</button>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					{/* Pagination */}
					{pagination && pagination.total_pages > 1 && (
						<div className="flex items-center justify-between border-t border-gray-200 dark:border-neutral-700 pt-4">
							<div className="text-sm text-gray-700 dark:text-gray-300">
								Page {pagination.page} of {pagination.total_pages} ({pagination.total} total)
							</div>
							<div className="flex gap-2">
								<button
									onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
									disabled={currentPage === 1}
									className="px-3 py-1 bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors">
									Previous
								</button>
								<button
									onClick={() => setCurrentPage((p) => Math.min(pagination.total_pages, p + 1))}
									disabled={currentPage === pagination.total_pages}
									className="px-3 py-1 bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors">
									Next
								</button>
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
};

export default NotificationsTab;
