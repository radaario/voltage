import { useMemo, useState } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Notification } from "@/interfaces/notification";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/utils";
import TimeAgo from "@/components/base/TimeAgo/TimeAgo";
import Tooltip from "@/components/base/Tooltip/Tooltip";
import Button from "@/components/base/Button/Button";
import Pagination from "@/components/base/Pagination";
import LoadingOverlay from "@/components/base/LoadingOverlay";
import EmptyState from "@/components/base/EmptyState";
import { MemoizedTableRow } from "@/components/base/MemoizedTableRow";
import { ArrowUturnLeftIcon, EyeIcon } from "@heroicons/react/24/outline";
import { JobCard, ConfirmModal } from "@/components";

interface PaginationInfo {
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	has_more?: boolean;
	next_page?: number | null;
	prev_page?: number | null;
}

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

	const columns = useMemo(
		() => [
			columnHelper.accessor("job_key", {
				header: "Job",
				cell: (info) => {
					const jobKey = info.getValue();
					if (!jobKey) return <span className="text-gray-400">-</span>;
					return <JobCard jobKey={jobKey} />;
				}
			}),
			columnHelper.accessor("payload.status", {
				header: "Event",
				cell: (info) => {
					const event = info.getValue();
					return (
						<div className="flex flex-col">
							<span className="font-medium text-gray-900 dark:text-white">{event || "UNKNOWN"}</span>
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
					<TimeAgo
						datetime={info.getValue()}
						locale="en_US"
					/>
				)
			}),
			columnHelper.display({
				id: "actions",
				header: "Actions",
				cell: (info) => {
					const notification = info.row.original;

					return (
						<div className="flex items-center gap-2">
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
									<ArrowUturnLeftIcon className="h-5 w-5" />
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
		[handleRetryNotification, retryNotificationMutation.isPending, navigate]
	);

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		manualPagination: true,
		pageCount: pagination.totalPages
	});

	return (
		<div className="w-full relative">
			{/* Loading Overlay */}
			<LoadingOverlay show={loading} />

			<div className="overflow-x-auto">
				<table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
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
				totalPages={pagination.totalPages}
				totalItems={pagination.total}
				itemsPerPage={pagination.limit}
				hasNextPage={!!pagination.next_page}
				hasPrevPage={!!pagination.prev_page}
				onPageChange={onPageChange}
			/>

			{/* Items per page selector */}
			<div className="px-6 py-3 flex items-center justify-end gap-4 border-t border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
				<span className="text-sm text-gray-700 dark:text-gray-300">
					<strong className="font-semibold text-gray-900 dark:text-white">{pagination.total}</strong> total notifications
				</span>

				<select
					value={pagination.limit}
					onChange={(e) => onLimitChange(Number(e.target.value))}
					className="px-3 py-1.5 text-sm border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-500">
					{[10, 25, 50, 100].map((pageSize) => (
						<option
							key={pageSize}
							value={pageSize}>
							{pageSize} per page
						</option>
					))}
				</select>
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

export default NotificationsTable;
