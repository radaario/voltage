import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EyeIcon, TrashIcon } from "@heroicons/react/24/outline";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Log } from "@/interfaces/log";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/utils";
import { Label, Button, Tooltip, TimeAgo, Pagination, LoadingOverlay, EmptyState, JobCard, WorkerCard, ConfirmModal } from "@/components";
import type { PaginationInfo } from "@/types";

interface LogsTableProps {
	data: Log[];
	loading: boolean;
	pagination: PaginationInfo;
	onPageChange: (page: number) => void;
	onLimitChange: (limit: number) => void;
	newLogKeys: Set<string>;
}

const columnHelper = createColumnHelper<Log>();

const LogsTable = ({ data, loading, pagination, onPageChange, onLimitChange, newLogKeys }: LogsTableProps) => {
	const navigate = useNavigate();
	const { authToken } = useAuth();
	const queryClient = useQueryClient();
	const [logToDelete, setLogToDelete] = useState<Log | null>(null);

	// Delete log mutation
	const deleteLogMutation = useMutation({
		mutationFn: async (logKey: string) => {
			return await api.delete("/logs", { token: authToken, log_key: logKey });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["logs"] });
			setLogToDelete(null);
		}
	});

	const handleDeleteLog = (log: Log) => {
		setLogToDelete(log);
	};

	const handleConfirmDelete = () => {
		if (logToDelete) {
			deleteLogMutation.mutate(logToDelete.key);
		}
	};

	const handleCloseDeleteModal = () => {
		if (!deleteLogMutation.isPending) {
			setLogToDelete(null);
		}
	};

	const columns = useMemo(
		() => [
			columnHelper.accessor("type", {
				header: "Log",
				cell: (info) => {
					const log = info.row.original;
					return (
						<div className="flex flex-col items-end sm:items-start gap-0.5 text-right sm:text-left">
							<Label
								status={log.type}
								size="sm">
								{log.type || "UNKNOWN"}
							</Label>
							<div className="font-medium text-gray-900 dark:text-white sm:truncate">{log.message || "-"}</div>
							<span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{log.key}</span>
						</div>
					);
				}
			}),
			columnHelper.accessor("worker_key", {
				header: "Worker",
				cell: (info) => {
					const log = info.row.original;
					const workerKey = info.getValue();
					const instanceKey = log?.instance_key;

					if (!workerKey) {
						return <span className="text-gray-400 text-right sm:text-left">-</span>;
					}

					return (
						<WorkerCard
							workerKey={workerKey}
							instanceKey={instanceKey}
							short={true}
						/>
					);
				}
			}),
			columnHelper.accessor("job_key", {
				header: "Job",
				cell: (info) => {
					const jobKey = info.getValue();

					if (!jobKey) {
						return <span className="text-gray-400 text-right sm:text-left">-</span>;
					}

					return <JobCard jobKey={jobKey} />;
				}
			}),
			columnHelper.accessor("created_at", {
				header: "Created At",
				cell: (info) => (
					<div className="text-right sm:text-left">
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
					const log = info.row.original;
					return (
						<div className="flex items-center justify-end sm:justify-start gap-2">
							<Tooltip content="Delete">
								<Button
									variant="soft"
									hover="danger"
									size="md"
									iconOnly
									onClick={(e) => {
										e.stopPropagation();
										handleDeleteLog(log);
									}}>
									<TrashIcon className="h-5 w-5" />
								</Button>
							</Tooltip>
							<Tooltip content="View">
								<Button
									variant="soft"
									size="md"
									iconOnly
									onClick={(e) => {
										e.stopPropagation();
										navigate(`/logs/${log.key}/info`);
									}}>
									<EyeIcon className="h-5 w-5" />
								</Button>
							</Tooltip>
						</div>
					);
				}
			})
		],
		[deleteLogMutation.isPending]
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
									message="There are no logs yet!"
									colSpan={columns.length}
								/>
							) : (
								table.getRowModel().rows.map((row) => {
									const log = row.original;
									const isNew = newLogKeys.has(log.key);
									return (
										<tr
											key={row.id}
											onClick={() => navigate(`/logs/${log.key}/info`)}
											className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors ${
												isNew ? "animate-pulse bg-green-50 dark:bg-green-900/20" : ""
											}`}>
											{row.getVisibleCells().map((cell) => (
												<td
													key={cell.id}
													data-label={cell.column.columnDef.header}
													className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
													<div>{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
												</td>
											))}
										</tr>
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

				{/* Delete Confirmation Modal */}
				{logToDelete && (
					<ConfirmModal
						isOpen={!!logToDelete}
						onClose={handleCloseDeleteModal}
						onConfirm={handleConfirmDelete}
						title="Delete Log"
						message={
							<>
								<p className="mb-4">Are you sure you want to delete this log?</p>
								<ul className="list-disc list-inside space-y-1 mb-4 text-sm">
									<li>{logToDelete.key}</li>
								</ul>
								<p className="font-semibold text-red-600 dark:text-red-400">This action cannot be undone!</p>
							</>
						}
						confirmText="Delete"
						variant="danger"
						isLoading={deleteLogMutation.isPending}
						loadingText="Deleting"
					/>
				)}
			</div>
		</div>
	);
};
export default LogsTable;
