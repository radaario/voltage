import { useMemo, useState } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Notification } from "@/interfaces/notification";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/utils";
import {
	ConfirmModal,
	Label,
	Tooltip,
	Button,
	TimeAgo,
	MemoizedTableRow,
	Pagination,
	LoadingOverlay,
	EmptyState,
	JobCard
} from "@/components";
import { ArrowPathIcon, EyeIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { PaginationInfo } from "@/types";

interface NotificationsTableProps {
	data: Notification[];
	loading: boolean;
	pagination: PaginationInfo;
	onPageChange: (page: number) => void;
	onLimitChange: (limit: number) => void;
	newNotificationKeys: Set<string>;
}

const columnHelper = createColumnHelper<Notification>();

const NotificationsTable = ({ data, loading, pagination, onPageChange, onLimitChange, newNotificationKeys }: NotificationsTableProps) => {
	const { authToken } = useAuth();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [notificationToRetry, setNotificationToRetry] = useState<Notification | null>(null);
	const [notificationToDelete, setNotificationToDelete] = useState<Notification | null>(null);

	// Retry notification mutation
	const retryNotificationMutation = useMutation({
		mutationFn: async (notificationKey: string) => {
			return await api.post("/jobs/notifications/retry", null, {
				params: { token: authToken, notification_key: notificationKey }
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["notifications"] });
		}
	});

	// Delete notification mutation
	const deleteNotificationMutation = useMutation({
		mutationFn: async (notificationKey: string) => {
			return await api.delete("/jobs/notifications", { token: authToken, notification_key: notificationKey });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["notifications"] });
			setNotificationToDelete(null);
		}
	});

	const handleRetryNotification = (notification: Notification) => {
		setNotificationToRetry(notification);
	};

	const handleConfirmRetry = () => {
		if (notificationToRetry) {
			retryNotificationMutation.mutate(notificationToRetry.key);
			setNotificationToRetry(null);
		}
	};

	const handleCloseRetryModal = () => {
		if (!retryNotificationMutation.isPending) {
			setNotificationToRetry(null);
		}
	};

	const handleDeleteNotification = (notification: Notification) => {
		setNotificationToDelete(notification);
	};

	const handleConfirmDelete = () => {
		if (notificationToDelete) {
			deleteNotificationMutation.mutate(notificationToDelete.key);
		}
	};

	const handleCloseDeleteModal = () => {
		if (!deleteNotificationMutation.isPending) {
			setNotificationToDelete(null);
		}
	};

	const columns = useMemo(
		() => [
			columnHelper.accessor("payload.status", {
				header: "Notification",
				cell: (info) => {
					const notification = info.row.original;
					const status = notification.payload?.status as string | undefined;
					return (
						<div className="flex flex-col items-end sm:items-start">
							<Label
								status={status}
								statusColor={false}
								size="sm">
								{status || "UNKNOWN"}
							</Label>
							<div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{notification.key}</div>
						</div>
					);
				}
			}),
			columnHelper.accessor("job_key", {
				header: "Job",
				cell: (info) => {
					const jobKey = info.getValue();
					if (!jobKey) return <span className="text-gray-400">-</span>;
					return <JobCard jobKey={jobKey} />;
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
					let colorClass =
						"bg-gray-100 text-gray-800 border-gray-300 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-700";

					if (status === "SUCCESSFUL") {
						colorClass =
							"bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800";
					} else if (status === "FAILED") {
						colorClass = "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
					} else if (status === "PENDING") {
						colorClass =
							"bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800";
					} else if (status === "SKIPPED") {
						colorClass =
							"bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-700";
					}

					return (
						<span className={`inline-flex items-center px-2.5 py-0.5 rounded border text-xs font-medium ${colorClass}`}>
							{status || "PENDING"}
						</span>
					);
				}
			}),
			columnHelper.accessor("updated_at", {
				header: "Updated At",
				cell: (info) => (
					<div className="text-right sm:text-left sm:min-w-[85px]">
						<TimeAgo
							datetime={info.getValue()}
							locale="en_US"
						/>
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
									size="md"
									iconOnly
									disabled={!["FAILED"].includes(notification?.status as string) || retryNotificationMutation.isPending}
									onClick={(e) => {
										e.stopPropagation();
										handleRetryNotification(notification);
									}}>
									<ArrowPathIcon className="h-5 w-5" />
								</Button>
							</Tooltip>

							<Tooltip content="Delete">
								<Button
									variant="soft"
									hover="danger"
									size="md"
									iconOnly
									onClick={(e) => {
										e.stopPropagation();
										handleDeleteNotification(notification);
									}}>
									<TrashIcon className="h-5 w-5" />
								</Button>
							</Tooltip>

							{/* View Button (right) */}
							<Tooltip content="View">
								<Button
									variant="soft"
									size="md"
									iconOnly
									onClick={(e) => {
										e.stopPropagation();
										navigate(`/notifications/${notification.key}/info`);
									}}>
									<EyeIcon className="h-5 w-5" />
								</Button>
							</Tooltip>
						</div>
					);
				}
			})
		],
		[retryNotificationMutation.isPending, deleteNotificationMutation.isPending]
	);

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		manualPagination: true,
		pageCount: pagination.total_pages
	});

	return (
		<div className="bg-gray-50 dark:bg-neutral-800 shadow-md rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700">
			<div className="w-full relative">
				{/* Loading Overlay */}
				<LoadingOverlay show={loading} />

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
									message="No notifications found"
									colSpan={columns.length}
								/>
							) : (
								table.getRowModel().rows.map((row) => {
									const notification = row.original;
									const isNew = newNotificationKeys.has(notification.key);
									return (
										<MemoizedTableRow
											key={row.id}
											row={row}
											isNew={isNew}
											onClick={() => navigate(`/notifications/${notification.key}/info`)}
										/>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				{/* Pagination Controls */}
				<Pagination
					currentPage={pagination.page}
					totalPages={pagination.total_pages}
					totalItems={pagination.total}
					itemsPerPage={pagination.limit}
					hasNextPage={!!pagination.next_page}
					hasPrevPage={!!pagination.prev_page}
					onPageChange={onPageChange}
					onLimitChange={onLimitChange}
				/>

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

				{/* Delete Confirmation Modal */}
				{notificationToDelete && (
					<ConfirmModal
						isOpen={!!notificationToDelete}
						onClose={handleCloseDeleteModal}
						onConfirm={handleConfirmDelete}
						title="Delete Notification"
						message={
							<>
								<p className="mb-4">Are you sure you want to delete this log?</p>
								<ul className="list-disc list-inside space-y-1 mb-4 text-sm">
									<li>{notificationToDelete.key}</li>
								</ul>
								<p className="font-semibold text-red-600 dark:text-red-400">This action cannot be undone!</p>
							</>
						}
						confirmText="Delete"
						variant="danger"
						isLoading={deleteNotificationMutation.isPending}
						loadingText="Deleting"
					/>
				)}
			</div>
		</div>
	);
};
export default NotificationsTable;
