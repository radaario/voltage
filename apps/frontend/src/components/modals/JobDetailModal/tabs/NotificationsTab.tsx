import { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import { formatDate } from "@/utils";
import type { Job } from "@/interfaces/job";
import type { Notification } from "@/interfaces/notification";
import Tooltip from "@/components/base/Tooltip/Tooltip";
import {
	ArrowUturnLeftIcon,
	EyeIcon,
	ChevronDoubleLeftIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronDoubleRightIcon
} from "@heroicons/react/24/outline";
import { ConfirmModal } from "@/components";

interface OutletContext {
	job: Job;
}

const NotificationsTab: React.FC = () => {
	const { job } = useOutletContext<OutletContext>();
	const { authToken } = useAuth();
	const { config } = useGlobalStateContext();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [currentPage, setCurrentPage] = useState(1);
	const [currentLimit] = useState(25);
	const [notificationToRetry, setNotificationToRetry] = useState<Notification | null>(null);

	// Fetch notifications
	const { data: notificationsResponse, isLoading } = useQuery<ApiResponse<Notification[]>>({
		queryKey: ["notifications", job.key, currentPage, currentLimit],
		queryFn: async () => {
			return await api.get<Notification[]>("/jobs/notifications", {
				token: authToken || "",
				job_key: job.key,
				page: currentPage,
				limit: currentLimit
			});
		},
		enabled: !!job.key && !!authToken
	});

	// Retry notification mutation
	const retryNotificationMutation = useMutation({
		mutationFn: async (notificationKey: string) => {
			return await api.post("/jobs/notifications/retry", null, {
				params: { token: authToken, notification_key: notificationKey }
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["notifications", job.key] });
			setNotificationToRetry(null);
		}
	});

	const handleRetryNotification = (notification: Notification) => {
		setNotificationToRetry(notification);
	};

	const handleConfirmRetry = () => {
		if (notificationToRetry) {
			retryNotificationMutation.mutate(notificationToRetry.key);
		}
	};

	const handleCloseRetryModal = () => {
		if (!retryNotificationMutation.isPending) {
			setNotificationToRetry(null);
		}
	};

	const notifications = notificationsResponse?.data || [];
	const pagination = notificationsResponse?.pagination;

	const getPageNumbers = () => {
		if (!pagination) return [];
		const pages: (number | string)[] = [];
		const maxVisible = 5;
		const totalPages = pagination.total_pages;

		if (totalPages <= maxVisible + 2) {
			// Show all pages if total is small
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			// Always show first page
			pages.push(1);

			if (currentPage > 3) {
				pages.push("...");
			}

			// Show pages around current page
			const start = Math.max(2, currentPage - 1);
			const end = Math.min(totalPages - 1, currentPage + 1);

			for (let i = start; i <= end; i++) {
				pages.push(i);
			}

			if (currentPage < totalPages - 2) {
				pages.push("...");
			}

			// Always show last page
			if (totalPages > 1) {
				pages.push(totalPages);
			}
		}

		return pages;
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

	return (
		<div className="space-y-4">
			{/*
			<div className="flex items-center justify-between">
				<h4 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h4>
			</div>
			*/}

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
					<div className="overflow-hidden border border-gray-200 dark:border-neutral-700 rounded-lg">
						<table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
							<thead className="bg-gray-50 dark:bg-neutral-900">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
										Event
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
										Priority
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
										Try
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
										Status
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
										Updated At
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
								{notifications.map((notification) => (
									<tr
										key={notification.key}
										className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
										<td className="px-6 py-4 text-sm">
											<span className="font-medium text-gray-900 dark:text-gray-100">
												{notification.payload.status || "UNKNOWN"}
											</span>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
											{notification.priority || "N/A"}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
											{(() => {
												const tryCount = notification.try_count || 0;
												const tryMax = notification.try_max;

												// If retry_max is not set or is 0, just show the count
												if (!tryMax || tryMax === 0) {
													return tryCount;
												}

												return `${tryCount} / ${tryMax}`;
											})()}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm">
											<span
												className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(notification.status)}`}>
												{notification.status || "PENDING"}
											</span>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
											{formatDate(notification.updated_at, config?.timezone || "UTC")}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm">
											<div className="flex items-center gap-2">
												{notification.status === "FAILED" && (
													<Tooltip content="Retry">
														<button
															onClick={() => handleRetryNotification(notification)}
															disabled={retryNotificationMutation.isPending}
															className="p-1.5 rounded-md transition-colors bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-600 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed">
															<ArrowUturnLeftIcon className="w-4 h-4" />
														</button>
													</Tooltip>
												)}
												{/* View Button (right) */}
												<Tooltip content="View">
													<button
														onClick={() => {
															// Close job modal and navigate to notification
															navigate(`/notifications/${notification.key}/info`);
														}}
														className="p-1.5 rounded-md transition-colors bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-600 hover:text-blue-600 dark:hover:text-blue-400">
														<EyeIcon className="w-4 h-4" />
													</button>
												</Tooltip>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					{/* Pagination */}
					{pagination && pagination.total_pages > 1 && (
						<div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-200 dark:border-neutral-700 pt-4">
							<div className="flex items-center gap-1">
								{/* First Page Button */}
								<button
									className="p-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:dark:hover:bg-neutral-800 transition-colors font-medium text-gray-700 dark:text-gray-200"
									onClick={() => setCurrentPage(1)}
									disabled={currentPage === 1 || pagination.total_pages === 0}
									title="First page">
									<ChevronDoubleLeftIcon className="w-4 h-4" />
								</button>

								{/* Previous Page Button */}
								<button
									className="p-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:dark:hover:bg-neutral-800 transition-colors font-medium text-gray-700 dark:text-gray-200"
									onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
									disabled={currentPage === 1 || pagination.total_pages === 0}
									title="Previous page">
									<ChevronLeftIcon className="w-4 h-4" />
								</button>

								{/* Page Numbers */}
								{getPageNumbers().map((pageNum, idx) => {
									if (pageNum === "...") {
										return (
											<span
												key={`ellipsis-${idx}`}
												className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400">
												...
											</span>
										);
									}

									const isActive = pageNum === currentPage;
									return (
										<button
											key={pageNum}
											className={`px-3 py-1.5 text-sm border rounded-md transition-colors font-medium ${
												isActive
													? "bg-gray-700 border-gray-700 text-white hover:bg-gray-800 dark:bg-neutral-600 dark:border-neutral-600 dark:hover:bg-neutral-700"
													: "bg-white dark:bg-neutral-800 border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700"
											} disabled:opacity-50 disabled:cursor-not-allowed`}
											onClick={() => setCurrentPage(pageNum as number)}
											disabled={pagination.total_pages === 0}>
											{pageNum}
										</button>
									);
								})}

								{/* Next Page Button */}
								<button
									className="p-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:dark:hover:bg-neutral-800 transition-colors font-medium text-gray-700 dark:text-gray-200"
									onClick={() => setCurrentPage((p) => Math.min(pagination.total_pages, p + 1))}
									disabled={currentPage === pagination.total_pages || pagination.total_pages === 0}
									title="Next page">
									<ChevronRightIcon className="w-4 h-4" />
								</button>

								{/* Last Page Button */}
								<button
									className="p-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:dark:hover:bg-neutral-800 transition-colors font-medium text-gray-700 dark:text-gray-200"
									onClick={() => setCurrentPage(pagination.total_pages)}
									disabled={currentPage === pagination.total_pages || pagination.total_pages === 0}
									title="Last page">
									<ChevronDoubleRightIcon className="w-4 h-4" />
								</button>
							</div>

							<div className="text-sm text-gray-700 dark:text-gray-300">
								<strong className="font-semibold text-gray-900 dark:text-white">{pagination.total}</strong> total
								notifications
							</div>
						</div>
					)}
				</>
			)}

			{/* Retry Confirmation Modal */}
			{notificationToRetry && (
				<ConfirmModal
					isOpen={!!notificationToRetry}
					onClose={handleCloseRetryModal}
					onConfirm={handleConfirmRetry}
					title="Retry Notification"
					message={
						<>
							Are you sure you want to retry notification <strong>{notificationToRetry.status}</strong>?
							<div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">({notificationToRetry.key})</div>
						</>
					}
					confirmText="Retry Notification"
					variant="info"
					isLoading={retryNotificationMutation.isPending}
					loadingText="Retrying"
				/>
			)}
		</div>
	);
};

export default NotificationsTab;
