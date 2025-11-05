import { useMemo, memo } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Job } from "@/interfaces/job";
import TimeAgo from "timeago-react";
import { useAuth } from "@/hooks/useAuth";
import Tooltip from "@/components/base/Tooltip/Tooltip";
import {
	ChevronDoubleLeftIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronDoubleRightIcon,
	EyeIcon,
	TrashIcon,
	ArrowPathIcon
} from "@heroicons/react/24/outline";

interface PaginationInfo {
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	has_more?: boolean;
	next_page?: number | null;
	prev_page?: number | null;
}

interface JobsTableProps {
	data: Job[];
	loading: boolean;
	pagination: PaginationInfo;
	onPageChange: (page: number) => void;
	onLimitChange: (limit: number) => void;
	onViewJob: (job: Job) => void;
	onDeleteJob: (job: Job) => void;
	onRetryJob: (job: Job) => void;
	newJobKeys: Set<string>;
}

const columnHelper = createColumnHelper<Job>();

// Memoized preview image component to prevent reloading on every render
const JobPreviewImage = memo(
	({ jobKey, authToken }: { jobKey: string; authToken: string | null }) => {
		return (
			<div className="w-20 h-14 relative shrink-0 bg-gray-100 dark:bg-neutral-800 group-hover:bg-gray-200 dark:group-hover:bg-neutral-700 rounded overflow-hidden transition-colors">
				<img
					key={jobKey}
					src={`${import.meta.env.VITE_API_BASE_URL}/jobs/preview?job_key=${jobKey}&token=${authToken}`}
					alt="Preview"
					className="w-full h-full object-cover"
					onError={(e) => {
						const target = e.target as HTMLImageElement;
						target.style.display = "none";
					}}
				/>
			</div>
		);
	},
	(prevProps, nextProps) => {
		// Custom comparison: only re-render if jobKey changes
		return prevProps.jobKey === nextProps.jobKey && prevProps.authToken === nextProps.authToken;
	}
);

JobPreviewImage.displayName = "JobPreviewImage";

// Memoized table row to prevent unnecessary re-renders
const TableRow = memo(
	({ row, onViewJob, isNew }: { row: any; onViewJob: (job: Job) => void; isNew: boolean }) => {
		return (
			<tr
				onClick={() => onViewJob(row.original)}
				className={`group hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all cursor-pointer ${
					isNew ? "animate-slide-in-highlight" : ""
				}`}>
				{row.getVisibleCells().map((cell: any) => (
					<td
						key={cell.id}
						className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
						{flexRender(cell.column.columnDef.cell, cell.getContext())}
					</td>
				))}
			</tr>
		);
	},
	(prevProps, nextProps) => {
		// Only re-render if the row data actually changed or isNew status changed
		return (
			prevProps.row.id === nextProps.row.id &&
			prevProps.row.original === nextProps.row.original &&
			prevProps.isNew === nextProps.isNew
		);
	}
);

TableRow.displayName = "TableRow";

const JobsTable = ({
	data,
	loading,
	pagination,
	onPageChange,
	onLimitChange,
	onViewJob,
	onDeleteJob,
	onRetryJob,
	newJobKeys
}: JobsTableProps) => {
	const { authToken } = useAuth();

	// Generate page numbers to display
	const getPageNumbers = () => {
		const { page, totalPages } = pagination;
		const pages: (number | string)[] = [];
		const maxVisible = 5;

		if (totalPages <= maxVisible + 2) {
			// Show all pages if total is small
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			// Always show first page
			pages.push(1);

			if (page > 3) {
				pages.push("...");
			}

			// Show pages around current page
			const start = Math.max(2, page - 1);
			const end = Math.min(totalPages - 1, page + 1);

			for (let i = start; i <= end; i++) {
				pages.push(i);
			}

			if (page < totalPages - 2) {
				pages.push("...");
			}

			// Always show last page
			if (totalPages > 1) {
				pages.push(totalPages);
			}
		}

		return pages;
	};

	const columns = useMemo(
		() => [
			columnHelper.display({
				id: "job",
				header: "Job",
				cell: (info) => {
					const job = info.row.original;
					const filename = job.input?.file_name || job.input?.url?.split("/").pop() || "Unknown";

					return (
						<div className="flex items-center gap-3">
							<JobPreviewImage
								jobKey={job.key}
								authToken={authToken}
							/>
							<div className="flex flex-col min-w-0">
								<div className="font-medium text-gray-900 dark:text-white truncate">{filename}</div>
								<div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{job.key}</div>
							</div>
						</div>
					);
				}
			}),
			columnHelper.accessor("status", {
				header: "Status",
				cell: (info) => {
					const status = info.getValue();
					const job = info.row.original;
					let colorClass =
						"bg-gray-100 text-gray-800 border-gray-300 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-700";

					if (status === "COMPLETED") {
						colorClass =
							"bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800";
					} else if (status === "FAILED") {
						colorClass = "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
					} else if (status === "RUNNING" || status === "ENCODING" || status === "DOWNLOADING" || status === "UPLOADING") {
						colorClass = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800";
					} else if (status === "PENDING" || status === "QUEUED") {
						colorClass =
							"bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800";
					}

					const progress = job.progress || 0;

					return (
						<span
							className={`relative inline-flex items-center px-3 py-1 rounded border text-sm font-medium overflow-hidden ${colorClass}`}>
							{/* Progress Bar Overlay */}
							<span
								className="absolute inset-0 bg-current opacity-10 transition-all duration-300"
								style={{ width: `${progress}%` }}
							/>
							{/* Text */}
							<span className="relative z-10">{status}</span>
						</span>
					);
				}
			}),
			columnHelper.display({
				id: "duration",
				header: "Duration",
				cell: (info) => {
					const job = info.row.original;
					const duration = job.input?.duration;

					if (!duration) return <span className="text-gray-400">-</span>;

					return <span>{Math.round(duration)}s</span>;
				}
			}),
			columnHelper.display({
				id: "resolution",
				header: "Resolution",
				cell: (info) => {
					const job = info.row.original;
					const width = job.input?.video_width;
					const height = job.input?.video_height;

					if (!width || !height) return <span className="text-gray-400">-</span>;

					return (
						<span>
							{width}x{height}
						</span>
					);
				}
			}),
			columnHelper.display({
				id: "size",
				header: "Size",
				cell: (info) => {
					const job = info.row.original;
					const size = job.input?.file_size;

					if (!size) return <span className="text-gray-400">-</span>;

					const sizeInMB = (size / (1024 * 1024)).toFixed(1);
					return <span>{sizeInMB}MB</span>;
				}
			}),
			columnHelper.accessor("priority", {
				header: "Priority",
				cell: (info) => {
					const priority = info.getValue();
					return <span className="font-mono text-gray-700 dark:text-gray-300">{priority}</span>;
				}
			}),
			columnHelper.display({
				id: "outputs",
				header: "Outputs",
				cell: () => {
					// Backend'de outputs bilgisi metadata içinde olabilir veya ayrı bir field olarak
					// Şimdilik 1 gösterelim, gerekirse backend'den outputs sayısını alabiliriz
					return <span>1</span>;
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
				id: "time",
				header: "Time",
				cell: (info) => {
					const job = info.row.original;

					if (!job.started_at) return <span className="text-gray-400">-</span>;
					if (!job.completed_at) return <span className="text-blue-600">In progress</span>;

					const start = new Date(job.started_at).getTime();
					const end = new Date(job.completed_at).getTime();
					const duration = Math.round((end - start) / 1000);

					return <span>{duration}s</span>;
				}
			}),
			columnHelper.display({
				id: "actions",
				header: "Actions",
				cell: (info) => {
					const job = info.row.original;
					return (
						<div className="flex items-center gap-1">
							<Tooltip content="View Details">
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onViewJob(job);
									}}
									className="p-2 bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-neutral-600 hover:text-gray-900 dark:hover:text-white transition-colors">
									<EyeIcon className="h-5 w-5" />
								</button>
							</Tooltip>
							<Tooltip content="Retry Job">
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onRetryJob(job);
									}}
									className="p-2 bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-neutral-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
									<ArrowPathIcon className="h-5 w-5" />
								</button>
							</Tooltip>
							<Tooltip content="Delete Job">
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onDeleteJob(job);
									}}
									className="p-2 bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-neutral-600 hover:text-red-600 dark:hover:text-red-400 transition-colors">
									<TrashIcon className="h-5 w-5" />
								</button>
							</Tooltip>
						</div>
					);
				}
			})
		],
		[authToken, onViewJob, onDeleteJob, onRetryJob]
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
										<div className="flex items-center gap-2">
											{flexRender(header.column.columnDef.header, header.getContext())}
										</div>
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
									No jobs found
								</td>
							</tr>
						) : (
							table.getRowModel().rows.map((row) => {
								const job = row.original;
								const isNew = newJobKeys.has(job.key);
								return (
									<TableRow
										key={row.id}
										row={row}
										onViewJob={onViewJob}
										isNew={isNew}
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
						<strong className="font-semibold text-gray-900 dark:text-white">{pagination.total}</strong> total jobs
					</span>

					<select
						value={pagination.limit}
						onChange={(e) => onLimitChange(Number(e.target.value))}
						className="px-3 py-1.5 text-sm border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-500">
						{[6, 10, 25, 50].map((pageSize) => (
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

export default JobsTable;
