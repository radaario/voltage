import { useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import Tooltip from "@/components/base/Tooltip/Tooltip";
import Button from "@/components/base/Button/Button";
import { EyeIcon } from "@heroicons/react/24/outline";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Log } from "@/interfaces/log";
import TimeAgo from "@/components/base/TimeAgo/TimeAgo";
import { ChevronDoubleLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDoubleRightIcon } from "@heroicons/react/24/outline";
import { JobCard, InstanceCard, WorkerCard } from "@/components";

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

// Memoized table row to prevent unnecessary re-renders
const TableRow = memo(
	({ row, isNew, onViewLog }: { row: any; isNew: boolean; onViewLog: (log: Log) => void }) => {
		return (
			<tr
				onClick={() => onViewLog(row.original)}
				className={`group hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all cursor-pointer ${isNew ? "animate-slide-in-highlight" : ""}`}>
				{row.getVisibleCells().map((cell: any) => (
					<td
						key={cell.id}
						className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
						{flexRender(cell.column.columnDef.cell, cell.getContext())}
					</td>
				))}
			</tr>
		);
	},
	(prevProps, nextProps) => {
		return (
			prevProps.row.id === nextProps.row.id &&
			prevProps.row.original === nextProps.row.original &&
			prevProps.isNew === nextProps.isNew
		);
	}
);

TableRow.displayName = "TableRow";

const LogsTable = ({ data, loading, pagination, onPageChange, onLimitChange, newLogKeys }: LogsTableProps) => {
	const navigate = useNavigate();
	// Generate page numbers to display
	const getPageNumbers = () => {
		const { page, totalPages } = pagination;
		const pages: (number | string)[] = [];
		const maxVisible = 5;

		if (totalPages <= maxVisible + 2) {
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			pages.push(1);

			if (page > 3) {
				pages.push("...");
			}

			const start = Math.max(2, page - 1);
			const end = Math.min(totalPages - 1, page + 1);

			for (let i = start; i <= end; i++) {
				pages.push(i);
			}

			if (page < totalPages - 2) {
				pages.push("...");
			}

			if (totalPages > 1) {
				pages.push(totalPages);
			}
		}

		return pages;
	};

	const columns = useMemo(
		() => [
			columnHelper.accessor("type", {
				header: "Type",
				cell: (info) => {
					const type = info.getValue();
					let colorClass =
						"bg-gray-100 text-gray-800 border-gray-300 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-700";

					if (type === "ERROR") {
						colorClass = "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
					} else if (type === "WARNING") {
						colorClass =
							"bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800";
					} else if (type === "INFO") {
						colorClass = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800";
					} else if (type === "DEBUG") {
						colorClass =
							"bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800";
					}

					return (
						<span className={`inline-flex items-center px-2.5 py-0.5 rounded border text-xs font-medium ${colorClass}`}>
							{type}
						</span>
					);
				}
			}),
			columnHelper.accessor("message", {
				header: "Message",
				cell: (info) => {
					const message = info.getValue();
					return (
						<div className="max-w-md">
							<span className="text-gray-900 dark:text-white line-clamp-2">{message || "-"}</span>
						</div>
					);
				}
			}),
			columnHelper.accessor("instance_key", {
				header: "Instance",
				cell: (info) => {
					const instanceKey = info.getValue();
					if (!instanceKey) return <span className="text-gray-400">-</span>;
					return <InstanceCard instanceKey={instanceKey} />;
				}
			}),
			columnHelper.accessor("worker_key", {
				header: "Worker",
				cell: (info) => {
					const workerKey = info.getValue();
					if (!workerKey) return <span className="text-gray-400">-</span>;
					return <WorkerCard workerKey={workerKey} />;
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
				header: "Created",
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
							<Tooltip content="View Log">
								<Button
									variant="ghost"
									size="md"
									iconOnly
									onClick={() => navigate(`/logs/${log.key}`)}>
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
			{loading && (
				<div className="absolute inset-0 bg-white/50 dark:bg-neutral-900/50 flex items-center justify-center z-10 rounded-lg">
					<div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-500 dark:border-gray-400 border-t-transparent"></div>
				</div>
			)}

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
							<tr>
								<td
									colSpan={columns.length}
									className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
									No logs found
								</td>
							</tr>
						) : (
							table.getRowModel().rows.map((row) => {
								const log = row.original;
								const isNew = newLogKeys.has(log.key);
								return (
									<TableRow
										key={row.id}
										row={row}
										isNew={isNew}
										onViewLog={(log) => navigate(`/logs/${log.key}`)}
									/>
								);
							})
						)}
					</tbody>
				</table>
			</div>

			{/* Pagination Controls */}
			<div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
				<div className="flex items-center gap-1">
					{/* First Page Button */}
					<button
						className="p-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:dark:hover:bg-neutral-800 transition-colors font-medium text-gray-700 dark:text-gray-200"
						onClick={() => onPageChange(1)}
						disabled={!pagination.prev_page || pagination.totalPages === 0}
						title="First page">
						<ChevronDoubleLeftIcon className="w-4 h-4" />
					</button>

					{/* Previous Page Button */}
					<button
						className="p-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:dark:hover:bg-neutral-800 transition-colors font-medium text-gray-700 dark:text-gray-200"
						onClick={() => onPageChange(pagination.prev_page!)}
						disabled={!pagination.prev_page || pagination.totalPages === 0}
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

						const isActive = pageNum === pagination.page;
						return (
							<button
								key={pageNum}
								className={`px-3 py-1.5 text-sm border rounded-md transition-colors font-medium ${
									isActive
										? "bg-gray-700 border-gray-700 text-white hover:bg-gray-800 dark:bg-neutral-600 dark:border-neutral-600 dark:hover:bg-neutral-700"
										: "bg-white dark:bg-neutral-800 border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700"
								} disabled:opacity-50 disabled:cursor-not-allowed`}
								onClick={() => onPageChange(pageNum as number)}
								disabled={pagination.totalPages === 0}>
								{pageNum}
							</button>
						);
					})}

					{/* Next Page Button */}
					<button
						className="p-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:dark:hover:bg-neutral-800 transition-colors font-medium text-gray-700 dark:text-gray-200"
						onClick={() => onPageChange(pagination.next_page!)}
						disabled={!pagination.has_more || !pagination.next_page || pagination.totalPages === 0}
						title="Next page">
						<ChevronRightIcon className="w-4 h-4" />
					</button>

					{/* Last Page Button */}
					<button
						className="p-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:dark:hover:bg-neutral-800 transition-colors font-medium text-gray-700 dark:text-gray-200"
						onClick={() => onPageChange(pagination.totalPages)}
						disabled={!pagination.has_more || !pagination.next_page || pagination.totalPages === 0}
						title="Last page">
						<ChevronDoubleRightIcon className="w-4 h-4" />
					</button>
				</div>

				<div className="flex items-center gap-4">
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
		</div>
	);
};

export default LogsTable;
