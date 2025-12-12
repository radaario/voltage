import { useState, useEffect, useRef } from "react";
import { useOutletContext, useNavigate, Outlet } from "react-router-dom";
import { Label, Tooltip, Button, Pagination, JobCard, WorkerCard, TimeAgo, LoadingSpinner } from "@/components";
import { EyeIcon } from "@heroicons/react/24/outline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Log } from "@/interfaces/log";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { InstanceOutletContext } from "@/types/modal";
import type { PaginationInfo } from "@/types";

const Logs: React.FC = () => {
	const { instance } = useOutletContext<InstanceOutletContext>();
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

	// Fetch logs with React Query
	const { data: logsResponse, isLoading } = useQuery<ApiResponse<Log[]>>({
		queryKey: ["instance-logs", instance.key, currentPage, currentLimit, searchQuery, typeFilter, authToken],
		queryFn: async () => {
			return await api.get<Log[]>("/logs", {
				token: authToken || "",
				instance_key: instance.key,
				page: currentPage,
				limit: currentLimit,
				...(searchQuery && { q: searchQuery }),
				...(typeFilter && { type: typeFilter })
			});
		},
		enabled: !!authToken && !!instance.key,
		placeholderData: (previousData) => previousData,
		refetchOnMount: "always",
		refetchOnWindowFocus: false
	});

	// effects
	useEffect(() => {
		queryClient.invalidateQueries({ queryKey: ["instance", instance.key] });
	}, [instance.key]);

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
									Worker & Job
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
									onClick={() => navigate(`/instances/${instance.key}/logs/${log.key}/info`)}
									className={`hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors cursor-pointer ${
										newLogKeys.has(log.key) ? "animate-pulse bg-green-50 dark:bg-green-900/20" : ""
									}`}>
									<td className="px-6 py-4 text-sm">
										<Label
											status={log.type}
											size="sm">
											{log.type || "INFO"}
										</Label>
										<div className="font-medium text-gray-900 dark:text-white truncate">{log.message || "-"}</div>
										<div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{log.key}</div>
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm">
										{log.worker_key && (
											<div className="my-1">
												<WorkerCard
													workerKey={log.worker_key}
													short={true}
												/>
											</div>
										)}
										{log.job_key && (
											<div className="my-1">
												<JobCard jobKey={log.job_key} />
											</div>
										)}
										{!log.worker_key && !log.job_key && <span className="text-gray-400">-</span>}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
										<div className="text-right sm:text-left sm:min-w-[85px]">
											<TimeAgo datetime={log.created_at} />
										</div>
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm">
										<Tooltip content="View">
											<Button
												variant="soft"
												size="sm"
												iconOnly
												onClick={(e) => {
													e.stopPropagation();
													navigate(`/instances/${instance.key}/logs/${log.key}/info`);
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
