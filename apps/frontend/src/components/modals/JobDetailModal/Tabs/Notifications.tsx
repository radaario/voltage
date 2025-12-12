import { useState, useMemo } from "react";
import { useOutletContext, useNavigate, Outlet } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import type { Notification } from "@/interfaces/notification";
import { Label, Tooltip, Button, ConfirmModal, Pagination, TimeAgo, LoadingOverlay, EmptyState, MemoizedTableRow } from "@/components";
import { ArrowPathIcon, EyeIcon } from "@heroicons/react/24/outline";
import type { JobOutletContext } from "@/types/modal";

const columnHelper = createColumnHelper<Notification>();

const Notifications: React.FC = () => {
	const { job } = useOutletContext<JobOutletContext>();
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

	const columns = useMemo(
		() => [
			columnHelper.accessor("payload.status", {
				header: "Notification",
				cell: (info) => {
					const notification = info.row.original;
					const status = notification.payload?.status as string | undefined;
					return (
						<div className="flex flex-col items-end sm:items-start gap-0.5">
							<Label
								status={status}
								statusColor={false}
								size="sm">
								{status || "UNKNOWN"}
							</Label>
							<span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{notification.key}</span>
						</div>
					);
				}
			}),
			columnHelper.accessor("priority", {
				header: "Priority",
				cell: (info) => {
					const priority = info.getValue();
					return <span className="font-mono text-gray-700 dark:text-gray-300">{priority || "N/A"}</span>;
				}
			}),
			columnHelper.display({
				id: "try",
				header: "Try",
				cell: (info) => {
					const notification = info.row.original;
					const tryCount = notification.try_count || 0;
					const tryMax = notification.try_max;

					// If try_max is not set or is 0, just show the count
					if (!tryMax || tryMax === 0) {
						return <span className="text-gray-600 dark:text-gray-400">{tryCount}</span>;
					}

					return (
						<span className="text-gray-600 dark:text-gray-400">
							{tryCount} / {tryMax}
						</span>
					);
				}
			}),
			columnHelper.accessor("status", {
				header: "Status",
				cell: (info) => {
					const status = info.getValue();
					return (
						<Label
							status={status}
							size="sm">
							{status || "PENDING"}
						</Label>
					);
				}
			}),
			columnHelper.accessor("updated_at", {
				header: "Updated At",
				cell: (info) => (
					<div className="text-right sm:text-left sm:min-w-[85px]">
						<TimeAgo datetime={info.getValue()} />
					</div>
				)
			}),
			columnHelper.display({
				id: "actions",
				header: "Actions",
				cell: (info) => {
					const notification = info.row.original;
					return (
						<div className="flex items-center justify-end sm:justify-start gap-2">
							<Tooltip content="Retry">
								<Button
									variant="soft"
									size="sm"
									iconOnly
									onClick={(e) => {
										e.stopPropagation();
										handleRetryNotification(notification);
									}}
									disabled={!["FAILED"].includes(notification?.status as string) || retryNotificationMutation.isPending}>
									<ArrowPathIcon className="w-4 h-4" />
								</Button>
							</Tooltip>
							<Tooltip content="View">
								<Button
									variant="soft"
									size="sm"
									iconOnly
									onClick={(e) => {
										e.stopPropagation();
										navigate(`/jobs/${job.key}/notifications/${notification.key}/info`);
									}}>
									<EyeIcon className="w-4 h-4" />
								</Button>
							</Tooltip>
						</div>
					);
				}
			})
		],
		[handleRetryNotification, retryNotificationMutation.isPending, job.key]
	);

	const table = useReactTable({
		data: notifications,
		columns,
		getCoreRowModel: getCoreRowModel(),
		manualPagination: true,
		pageCount: pagination?.total_pages || 0
	});

	return (
		<div className="space-y-4">
			<div className="bg-gray-50 dark:bg-neutral-800 shadow-md rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700">
				<div className="w-full relative">
					{/* Loading Overlay */}
					<LoadingOverlay show={isLoading} />

					<div className="overflow-x-auto">
						<table className="responsive-table min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
							<thead className="bg-gray-50 dark:bg-neutral-800">
								{table.getHeaderGroups().map((headerGroup) => (
									<tr key={headerGroup.id}>
										{headerGroup.headers.map((header) => (
											<th
												key={header.id}
												scope="col"
												className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
												{flexRender(header.column.columnDef.header, header.getContext())}
											</th>
										))}
									</tr>
								))}
							</thead>
							<tbody className="bg-white dark:bg-neutral-900 divide-y divide-gray-200 dark:divide-neutral-800">
								{table.getRowModel().rows.length === 0 ? (
									<EmptyState
										message="No notifications found for this job"
										colSpan={columns.length}
									/>
								) : (
									table.getRowModel().rows.map((row) => {
										const notification = row.original;
										return (
											<MemoizedTableRow
												key={row.id}
												row={row}
												onClick={() => navigate(`/jobs/${job.key}/notifications/${notification.key}/info`)}
											/>
										);
									})
								)}
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
				</div>
			</div>

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
