import { useMemo } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Job } from "@/interfaces/job";
import { Label, Button, Tooltip, TimeAgo, MemoizedTableRow, Pagination, LoadingOverlay, EmptyState } from "@/components";
import { JobPreviewImage } from "@/components";
import { EyeIcon, TrashIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

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
	const columns = useMemo(
		() => [
			columnHelper.display({
				id: "job",
				header: "Job",
				cell: (info) => {
					const job = info.row.original;
					const filename = job.input?.file_name || job.input?.url?.split("/").pop() || null;

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
						<div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 overflow-hidden">
							<JobPreviewImage
								jobKey={job.key}
								duration={job?.input?.duration}
								version={job.analyzed_at}
							/>
							<div
								className="flex flex-col items-start min-w-0"
								style={{ wordBreak: "break-all" }}>
								{filename && <div className="font-medium text-gray-900 dark:text-white sm:truncate">{filename}</div>}
								<div className="text-xs text-gray-500 dark:text-gray-400 font-mono sm:truncate hidden sm:block">
									{job.key}
								</div>
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
					// The outputs information might be in metadata or as a separate field in the backend
					// For now, let's show 1, we can fetch the outputs count from the backend if needed
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
				id: "progress",
				header: "Progress",
				cell: (info) => {
					const job = info.row.original;

					const duration = (() => {
						// If the job has not started yet
						if (!job.started_at || !job.completed_at) {
							return null; //<span className="text-gray-400">-</span>;
						}

						// If both dates are present, calculate the duration
						try {
							const started_at = new Date(job.started_at).getTime();
							const completed_at = new Date(job.completed_at).getTime();

							// Invalid date check
							if (isNaN(started_at) || isNaN(completed_at)) {
								return null; //<span className="text-gray-400">-</span>;
							}

							// Negative or too large value check
							const duration = (completed_at - started_at) / 1000; // duration in seconds
							if (duration < 0 || duration > 86400) {
								// If more than 24 hours
								return <span className="text-gray-400">Invalid</span>;
							}

							// Format the duration
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
					})();

					return (
						<div className="text-right sm:text-left">
							<div>%{job.progress || 0}</div>
							{duration && <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{duration}</div>}
						</div>
					);
				}
			}),
			columnHelper.accessor("status", {
				header: "Status",
				cell: (info) => {
					const status = info.getValue();
					const job = info.row.original;
					const progress = job.progress || 0;

					return (
						<div className="relative flex justify-end rounded overflow-hidden">
							<Label
								status={status}
								progress={progress}>
								{status}
							</Label>
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
						<div className="flex items-center justify-end sm:justify-start gap-2">
							<Tooltip content="Retry">
								<Button
									variant="soft"
									size="md"
									iconOnly
									disabled={
										!["QUEUED", "COMPLETED", "CANCELLED", "DELETED", "FAILED", "TIMEOUT"].includes(
											job?.status as string
										)
									}
									onClick={(e) => {
										e.stopPropagation();
										onRetryJob(job);
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
									// disabled={!["RECEIVED", "PENDING", "RETRYING", "DELETED"].includes(job?.status as string)}
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
					onLimitChange={onLimitChange}
				/>
			</div>
		</div>
	);
};
export default JobsTable;
