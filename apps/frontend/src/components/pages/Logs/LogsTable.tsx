import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { EyeIcon } from "@heroicons/react/24/outline";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Log } from "@/interfaces/log";
import {
	Label,
	Button,
	Tooltip,
	TimeAgo,
	Pagination,
	MemoizedTableRow,
	LoadingOverlay,
	EmptyState,
	JobCard,
	WorkerCard
} from "@/components";

interface PaginationInfo {
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	has_more?: boolean;
	next_page?: number | null;
	prev_page?: number | null;
}

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

	const columns = useMemo(
		() => [
			columnHelper.accessor("type", {
				header: "Log",
				cell: (info) => {
					const log = info.row.original;
					return (
						<>
							<Label
								status={log.type}
								size="sm">
								{log.type || "UNKNOWN"}
							</Label>
							<div className="font-medium text-gray-900 dark:text-white truncate">{log.message || "-"}</div>
							<span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{log.key}</span>
						</>
					);
				}
			}),
			columnHelper.accessor("worker_key", {
				header: "Worker",
				cell: (info) => {
					const log = info.row.original;
					const workerKey = info.getValue();
					const instanceKey = log?.instance_key;
					if (!workerKey) return <span className="text-gray-400">-</span>;
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
					if (!jobKey) return <span className="text-gray-400">-</span>;
					return <JobCard jobKey={jobKey} />;
				}
			}),
			columnHelper.accessor("created_at", {
				header: "Created At",
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
					const log = info.row.original;
					return (
						<div className="flex items-center gap-2">
							<Tooltip content="View">
								<Button
									variant="soft"
									size="md"
									iconOnly
									onClick={() => navigate(`/logs/${log.key}/info`)}>
									<EyeIcon className="h-5 w-5" />
								</Button>
							</Tooltip>
						</div>
					);
				}
			})
		],
		[]
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
								message="No logs found"
								colSpan={columns.length}
							/>
						) : (
							table.getRowModel().rows.map((row) => {
								const log = row.original;
								const isNew = newLogKeys.has(log.key);
								return (
									<MemoizedTableRow
										key={row.id}
										row={row}
										isNew={isNew}
										onClick={() => navigate(`/logs/${log.key}/info`)}
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
					<strong className="font-semibold text-gray-900 dark:text-white">{pagination.total}</strong> total logs
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
		</div>
	);
};

export default LogsTable;
