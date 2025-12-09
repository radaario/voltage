import { useState, useEffect, useRef } from "react";
import { useOutletContext, useNavigate, Outlet } from "react-router-dom";
import { Label, Tooltip, Button, Pagination, JobCard, TimeAgo, LoadingSpinner } from "@/components";
import { EyeIcon } from "@heroicons/react/24/outline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Worker } from "@/interfaces";
import type { Log } from "@/interfaces/log";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface OutletContext {
	worker: Worker;
}

interface PaginationInfo {
	total: number;
	page: number;
	limit: number;
	total_pages: number;
	has_more?: boolean;
	next_page?: number | null;
	prev_page?: number | null;
}

const Logs: React.FC = () => {
	const { worker } = useOutletContext<OutletContext>();
	const navigate = useNavigate();
	const { authToken } = useAuth();
	const queryClient = useQueryClient();

	// states
	const [searchQuery, setSearchQuery] = useState("");
	const [searchInput, setSearchInput] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [currentLimit] = useState(25);
	const [typeFilter, setTypeFilter] = useState<string>("");
	const previousDataRef = useRef<Log[]>([]);
	const [newLogKeys, setNewLogKeys] = useState<Set<string>>(new Set());

	// querys
	// Fetch logs with React Query
	const { data: logsResponse, isLoading } = useQuery<ApiResponse<Log[]>>({
		queryKey: ["worker-logs", worker.key, currentPage, currentLimit, searchQuery, typeFilter, authToken],
		queryFn: async () => {
			return await api.get<Log[]>("/logs", {
				token: authToken || "",
				worker_key: worker.key,
				page: currentPage,
				limit: currentLimit,
				...(searchQuery && { q: searchQuery }),
				...(typeFilter && { type: typeFilter })
			});
		},
		enabled: !!authToken && !!worker.key,
		placeholderData: (previousData) => previousData,
		refetchOnMount: "always",
		refetchOnWindowFocus: false
	});

	// data
	const logs = logsResponse?.data || [];
	const pagination: PaginationInfo | undefined = logsResponse?.pagination;

	// actions
	const clearSearch = () => {
		setSearchInput("");
	};

	// effects
	useEffect(() => {
		queryClient.invalidateQueries({ queryKey: ["worker", worker.key] });
	}, [worker.key]);

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

		// Initial load: just set the ref, don't show the animation
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
			{isLoading ? (
				<LoadingSpinner />
			) : logs.length === 0 ? (
				<div className="text-center py-12">
					<p className="text-sm text-gray-600 dark:text-gray-400">There are no logs yet!</p>
				</div>
			) : (
				<div className="overflow-hidden border border-gray-200 dark:border-neutral-700 rounded-lg overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
						<thead className="bg-gray-50 dark:bg-neutral-900">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Log
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Job
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Created At
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
							{logs.map((log: Log) => (
								<tr
									key={log.key}
									onClick={() => navigate(`${log.key}/info`)}
									className={`hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors cursor-pointer ${
										newLogKeys.has(log.key) ? "animate-pulse bg-green-50 dark:bg-green-900/20" : ""
									}`}>
									<td className="px-6 py-4 text-sm">
										<Label
											status={log.type as any}
											size="sm">
											{log.type || "INFO"}
										</Label>
										<div className="font-medium text-gray-900 dark:text-white truncate">{log.message || "-"}</div>
										<div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{log.key}</div>
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm">
										{log.job_key ? <JobCard jobKey={log.job_key} /> : <span className="text-gray-400">-</span>}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
										<TimeAgo datetime={log.created_at} />
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm">
										<Tooltip content="View">
											<Button
												variant="soft"
												size="sm"
												iconOnly
												onClick={(e) => {
													e.stopPropagation();
													navigate(`${log.key}/info`);
												}}>
												<EyeIcon className="w-4 h-4" />
											</Button>
										</Tooltip>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

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
