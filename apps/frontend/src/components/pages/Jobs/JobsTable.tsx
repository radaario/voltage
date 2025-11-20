import { useMemo } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Job } from "@/interfaces/job";
import TimeAgo from "@/components/base/TimeAgo/TimeAgo";
import Label from "@/components/base/Label/Label";
import { useAuth } from "@/hooks/useAuth";
import Tooltip from "@/components/base/Tooltip/Tooltip";
import Button from "@/components/base/Button/Button";
import { JobPreviewImage } from "@/components/composite/JobPreviewImage";
import Pagination from "@/components/base/Pagination";
import LoadingOverlay from "@/components/base/LoadingOverlay";
import EmptyState from "@/components/base/EmptyState";
import { MemoizedTableRow } from "@/components/base/MemoizedTableRow";
import { EyeIcon, TrashIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/outline";

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

	const columns = useMemo(
		() => [
			columnHelper.display({
				id: "job",
				header: "Job",
				cell: (info) => {
					const job = info.row.original;
					const filename = job.input?.file_name || job.input?.url?.split("/").pop() || "Unknown";

					const specs: string[] = [];

					// Resolution
					const width = job.input?.video_width;
					const height = job.input?.video_height;
					if (width && height) {
						specs.push(`${width}x${height}px`);
					}

					// Size
					const size = job.input?.file_size;
					if (size) {
						const sizeInMB = (size / (1024 * 1024)).toFixed(1);
						specs.push(`${sizeInMB}mb`);
					}

					return (
						<div className="flex items-center gap-3">
							<JobPreviewImage
								jobKey={job.key}
								authToken={authToken}
								duration={job?.input?.duration}
								version={job.updated_at}
							/>
							<div className="flex flex-col min-w-0">
								<div className="font-medium text-gray-900 dark:text-white truncate">{filename}</div>
								<div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{job.key}</div>
								{specs.length > 0 && (
									<span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{specs.join(", ")}</span>
								)}
							</div>
						</div>
					);
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
			columnHelper.display({
				id: "try",
				header: "Try",
				cell: (info) => {
					const job = info.row.original;
					const tryCount = job.try_count || 0;
					const tryMax = job.try_max;

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
			columnHelper.display({
				id: "duration",
				header: "Duration",
				cell: (info) => {
					const job = info.row.original;

					// Job henüz başlamadıysa
					if (!job.started_at || !job.completed_at) return <span className="text-gray-400">-</span>;

					// Her iki tarih de varsa süreyi hesapla
					try {
						const started_at = new Date(job.started_at).getTime();
						const completed_at = new Date(job.completed_at).getTime();

						// Geçersiz tarih kontrolü
						if (isNaN(started_at) || isNaN(completed_at)) {
							return <span className="text-gray-400">-</span>;
						}

						// Negatif veya çok büyük değer kontrolü
						const duration = (completed_at - started_at) / 1000; // saniye cinsinden
						if (duration < 0 || duration > 86400) {
							// 24 saatten fazla ise
							return <span className="text-gray-400">Invalid</span>;
						}

						// Süreyi formatla
						if (duration < 60) {
							return <span>{Math.round(duration)}s</span>;
						} else if (duration < 3600) {
							const minutes = Math.floor(duration / 60);
							const seconds = Math.round(duration % 60);
							return (
								<span>
									{minutes}m {seconds}s
								</span>
							);
						} else {
							const hours = Math.floor(duration / 3600);
							const minutes = Math.floor((duration % 3600) / 60);
							return (
								<span>
									{hours}h {minutes}m
								</span>
							);
						}
					} catch (error) {
						return <span className="text-gray-400">-</span>;
					}
				}
			}),
			columnHelper.accessor("status", {
				header: "Status",
				cell: (info) => {
					const status = info.getValue();
					const job = info.row.original;
					const progress = job.progress || 0;

					// Progress bar color based on status
					const getProgressBarColor = (status: string) => {
						switch (status) {
							case "COMPLETED":
								return "bg-green-700 dark:bg-green-500";
							case "FAILED":
								return "bg-red-700 dark:bg-red-500";
							case "CANCELLED":
								return "bg-gray-700 dark:bg-gray-500";
							case "PENDING":
								return "bg-yellow-700 dark:bg-yellow-500";
							case "PROCESSING":
								return "bg-blue-700 dark:bg-blue-500";
							default:
								return "bg-nautral-700 dark:bg-nautral-500";
						}
					};

					return (
						<div className="relative inline-flex rounded overflow-hidden">
							<Label status={status}>{status}</Label>
							{/* Progress Bar Overlay */}
							{progress > 0 && progress < 100 && (
								<span
									className={`absolute bottom-0 left-0 h-full opacity-50 transition-all duration-300 ${getProgressBarColor(status)}`}
									style={{ width: `${progress}%` }}
								/>
							)}
						</div>
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
					const job = info.row.original;
					return (
						<div className="flex items-center gap-1">
							<Tooltip content="Retry">
								<Button
									variant="soft"
									size="md"
									iconOnly
									disabled={!["CANCELLED", "DELETED", "FAILED", "TIMEOUT"].includes(job?.status as string)}
									onClick={(e) => {
										e.stopPropagation();
										onRetryJob(job);
									}}>
									<ArrowUturnLeftIcon className="h-5 w-5" />
								</Button>
							</Tooltip>
							<Tooltip content="Delete">
								<Button
									variant="soft"
									size="md"
									iconOnly
									disabled={!["RECEIVED", "PENDING", "RETRYING"].includes(job?.status as string)}
									onClick={(e) => {
										e.stopPropagation();
										onDeleteJob(job);
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
										onViewJob(job);
									}}>
									<EyeIcon className="h-5 w-5" />
								</Button>
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
							<EmptyState
								message="No jobs found"
								colSpan={columns.length}
							/>
						) : (
							table.getRowModel().rows.map((row) => {
								const job = row.original;
								const isNew = newJobKeys.has(job.key);
								return (
									<MemoizedTableRow
										key={row.id}
										row={row}
										isNew={isNew}
										onClick={onViewJob}
										className="whitespace-nowrap"
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
	);
};

export default JobsTable;
