import { useState, useEffect, useRef, useMemo } from "react";
import { useOutletContext, useNavigate, Outlet } from "react-router-dom";
import { Label, Tooltip, Button, Pagination, TimeAgo, LoadingOverlay, EmptyState, WorkerCard, MemoizedTableRow } from "@/components";
import { EyeIcon } from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { Log } from "@/interfaces/log";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { JobOutletContext } from "@/types/modal";
import type { PaginationInfo } from "@/types";

const columnHelper = createColumnHelper<Log>();

const Logs: React.FC = () => {
	const { job } = useOutletContext<JobOutletContext>();
	const navigate = useNavigate();
	const { authToken } = useAuth();

	const [searchQuery, setSearchQuery] = useState("");
	const [searchInput, setSearchInput] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [currentLimit] = useState(25);
	const [typeFilter, setTypeFilter] = useState<string>("");
	const previousDataRef = useRef<Log[]>([]);
	const [newLogKeys, setNewLogKeys] = useState<Set<string>>(new Set());

	// Fetch logs with React Query
	const { data: logsResponse, isLoading } = useQuery<ApiResponse<Log[]>>({
		queryKey: ["job-logs", job.key, currentPage, currentLimit, searchQuery, typeFilter, authToken],
		queryFn: async () => {
			return await api.get<Log[]>("/logs", {
				token: authToken || "",
				job_key: job.key,
				page: currentPage,
				limit: currentLimit,
				...(searchQuery && { q: searchQuery }),
				...(typeFilter && { type: typeFilter })
			});
		},
		enabled: !!authToken && !!job.key,
		placeholderData: (previousData) => previousData,
		refetchOnMount: "always"
	});

	// Debounce search input (500ms)
	useEffect(() => {
		const timer = setTimeout(() => {
			setSearchQuery(searchInput);
		}, 500);

		return () => clearTimeout(timer);
	}, [searchInput]);

	// Reset to page 1 when search query changes
	useEffect(() => {
		if (searchQuery !== "") {
			setCurrentPage(1);
		}
	}, [searchQuery]);

	// Detect new logs when data updates
	useEffect(() => {
		const logs = logsResponse?.data;
		if (!logs || currentPage !== 1) {
			return;
		}

		// First load: just set the ref, do not show animation
		if (previousDataRef.current.length === 0) {
			previousDataRef.current = logs || [];
			return;
		}

		const currentLogKeys = new Set((logs || []).map((log: Log) => log.key));
		const previousLogKeys = new Set(previousDataRef.current.map((log: Log) => log.key));

		const newKeys = [...currentLogKeys].filter((key) => !previousLogKeys.has(key));

		if (newKeys.length > 0) {
			setNewLogKeys(new Set(newKeys));
			setTimeout(() => {
				setNewLogKeys(new Set());
			}, 2000);
		}

		previousDataRef.current = logs || [];
	}, [logsResponse?.data, currentPage]);

	const logs = logsResponse?.data || [];
	const pagination: PaginationInfo | undefined = logsResponse?.pagination;

	const clearSearch = () => {
		setSearchInput("");
	};

	const columns = useMemo(
		() => [
			columnHelper.accessor("type", {
				header: "Log",
				cell: (info) => {
					const log = info.row.original;
					return (
						<div className="flex flex-col items-end sm:items-start gap-0.5 text-right sm:text-left max-w-[350px]">
							<Label
								status={log.type}
								size="sm">
								{log.type || "INFO"}
							</Label>
							<div className="font-medium text-gray-900 dark:text-white">{log.message || "-"}</div>
							<span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{log.key}</span>
						</div>
					);
				}
			}),
			columnHelper.accessor("worker_key", {
				header: "Worker",
				cell: (info) => {
					const workerKey = info.getValue();
					if (!workerKey) {
						return <span className="text-gray-400 text-right sm:text-left">-</span>;
					}
					return (
						<WorkerCard
							workerKey={workerKey}
							short={true}
						/>
					);
				}
			}),
			columnHelper.accessor("created_at", {
				header: "Created At",
				cell: (info) => (
					<div className="text-right sm:text-left">
						<div className="text-right sm:text-left sm:min-w-[85px]">
							<TimeAgo datetime={info.getValue()} />
						</div>
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
							<Tooltip content="View">
								<Button
									variant="soft"
									size="sm"
									iconOnly
									onClick={(e) => {
										e.stopPropagation();
										navigate(`/jobs/${job.key}/logs/${log.key}/info`);
									}}>
									<EyeIcon className="w-4 h-4" />
								</Button>
							</Tooltip>
						</div>
					);
				}
			})
		],
		[job.key]
	);

	const table = useReactTable({
		data: logs,
		columns,
		getCoreRowModel: getCoreRowModel(),
		manualPagination: true,
		pageCount: pagination?.total_pages || 0
	});

	return (
		<div className="space-y-4">
			{/* Filters */}
			<div className="flex items-center gap-3">
				{/* Type Filter */}
				<select
					value={typeFilter}
					onChange={(e) => {
						setTypeFilter(e.target.value);
						setCurrentPage(1);
					}}
					className="px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-neutral-500">
					<option value="">All Types</option>
					<option value="INFO">Info</option>
					<option value="WARNING">Warning</option>
					<option value="ERROR">Error</option>
					{/* <option value="DEBUG">Debug</option> */}
				</select>

				{/* Search Bar */}
				<div className="relative flex-1">
					<MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
					<input
						type="text"
						placeholder="Search logs..."
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
						className="w-full pl-9 pr-9 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-neutral-500"
					/>
					{searchInput && (
						<button
							type="button"
							onClick={clearSearch}
							className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
							<XMarkIcon className="w-4 h-4" />
						</button>
					)}
				</div>
			</div>

			{/* Table */}
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
										message="There are no logs yet!"
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
												onClick={() => navigate(`/jobs/${job.key}/logs/${log.key}/info`)}
											/>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				</div>
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
			{/* Outlet for nested modals */}
			<Outlet />
		</div>
	);
};

export default Logs;
