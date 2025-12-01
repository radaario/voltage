import { useState } from "react";
import { useOutletContext, useNavigate, Outlet } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import type { Job } from "@/interfaces/job";
import type { Notification } from "@/interfaces/notification";
import { Label, Tooltip, Button, ConfirmModal, Pagination, TimeAgo, LoadingSpinner } from "@/components";
import { ArrowPathIcon, EyeIcon } from "@heroicons/react/24/outline";

interface OutletContext {
	job: Job;
}

const Notifications: React.FC = () => {
	const { job } = useOutletContext<OutletContext>();
	const { authToken } = useAuth();
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
		enabled: !!job.key && !!authToken,
		refetchOnMount: "always"
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

	return (
		<div className="space-y-4">
			{/*
			<div className="flex items-center justify-between">
				<h4 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h4>
			</div>
			*/}

			{isLoading ? (
				<LoadingSpinner />
			) : notifications.length === 0 ? (
				<div className="text-center py-12">
					<p className="text-sm text-gray-600 dark:text-gray-400">No notifications found for this job.</p>
				</div>
			) : (
				<>
					<div className="overflow-hidden border border-gray-200 dark:border-neutral-700 rounded-lg overflow-x-auto">
						<table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
							<thead className="bg-gray-50 dark:bg-neutral-900">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
										Notification
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
										onClick={() => navigate(`/jobs/${job.key}/notifications/${notification.key}/info`)}
										className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors cursor-pointer">
										<td className="px-6 py-4 text-sm">
											<Label
												status={notification.payload.status}
												statusColor={false}
												size="sm">
												{notification.payload.status || "UNKNOWN"}
											</Label>
											<span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{notification.key}</span>
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
											<Label
												status={notification.status}
												size="sm">
												{notification.status || "PENDING"}
											</Label>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
											<TimeAgo datetime={notification.updated_at} />
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm">
											<div
												className="flex items-center gap-2"
												onClick={(e) => e.stopPropagation()}>
												<Tooltip content="Retry">
													<Button
														variant="soft"
														size="sm"
														iconOnly
														onClick={() => handleRetryNotification(notification)}
														disabled={
															!["FAILED"].includes(notification?.status as string) ||
															retryNotificationMutation.isPending
														}>
														<ArrowPathIcon className="w-4 h-4" />
													</Button>
												</Tooltip>
												{/* View Button (right) */}
												<Tooltip content="View">
													<Button
														variant="soft"
														size="sm"
														iconOnly
														onClick={() => {
															navigate(`/jobs/${job.key}/notifications/${notification.key}/info`);
														}}>
														<EyeIcon className="w-4 h-4" />
													</Button>
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
						<Pagination
							currentPage={currentPage}
							totalPages={pagination.total_pages}
							totalItems={pagination.total}
							itemsPerPage={currentLimit}
							hasNextPage={currentPage < pagination.total_pages}
							hasPrevPage={currentPage > 1}
							onPageChange={setCurrentPage}
						/>
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
							<p className="mb-4">Are you sure you want to retry this notification?</p>
							<ul className="list-disc list-inside space-y-1 mb-4 text-sm">
								<li>{notificationToRetry.key}</li>
							</ul>
						</>
					}
					confirmText="Retry"
					variant="info"
					isLoading={retryNotificationMutation.isPending}
					loadingText="Retrying"
				/>
			)}

			{/* Nested Outlet for NotificationDetailModal */}
			<Outlet context={{ job }} />
		</div>
	);
};

export default Notifications;
