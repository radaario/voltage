import { useState, useEffect, useRef } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import Tooltip from "@/components/base/Tooltip/Tooltip";
import Button from "@/components/base/Button/Button";
import { EyeIcon } from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import type { Job } from "@/interfaces/job";
import type { Log, LogsResponse } from "@/interfaces/log";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import { formatDate } from "@/utils";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface OutletContext {
	job: Job;
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

const LogsTab: React.FC = () => {
	const { job } = useOutletContext<OutletContext>();
	const navigate = useNavigate();
	const { authToken } = useAuth();
	const { config } = useGlobalStateContext();

	const [searchQuery, setSearchQuery] = useState("");
	const [searchInput, setSearchInput] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [currentLimit] = useState(25);
	const [typeFilter, setTypeFilter] = useState<string>("");
	const previousDataRef = useRef<Log[]>([]);
	const [newLogKeys, setNewLogKeys] = useState<Set<string>>(new Set());

	// Fetch logs with React Query
	const { data: logsResponse, isLoading } = useQuery<ApiResponse<LogsResponse>>({
		queryKey: ["job-logs", job.key, currentPage, currentLimit, searchQuery, typeFilter, authToken],
		queryFn: async () => {
			return await api.get<LogsResponse>("/logs", {
				token: authToken || "",
				job_key: job.key,
				page: currentPage,
				limit: currentLimit,
				...(searchQuery && { q: searchQuery }),
				...(typeFilter && { type: typeFilter })
			});
		},
		enabled: !!authToken && !!job.key,
		refetchInterval: 5000
	});

	// Detect new logs when data updates
	useEffect(() => {
		const logs = logsResponse?.data?.data;
		if (!logs || currentPage !== 1) {
			return;
		}

		// İlk yükleme: sadece ref'i set et, animasyon gösterme
		if (previousDataRef.current.length === 0) {
			previousDataRef.current = logs;
			return;
		}

		const currentLogKeys = new Set(logs.map((log) => log.key));
		const previousLogKeys = new Set(previousDataRef.current.map((log) => log.key));

		const newKeys = [...currentLogKeys].filter((key) => !previousLogKeys.has(key));

		if (newKeys.length > 0) {
			setNewLogKeys(new Set(newKeys));
			setTimeout(() => {
				setNewLogKeys(new Set());
			}, 2000);
		}

		previousDataRef.current = logs;
	}, [logsResponse?.data?.data, currentPage]);

	const logs = logsResponse?.data?.data || [];
	const pagination: PaginationInfo | undefined = logsResponse?.data?.pagination;

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		setSearchQuery(searchInput);
		setCurrentPage(1);
	};

	const clearSearch = () => {
		setSearchInput("");
		setSearchQuery("");
		setCurrentPage(1);
	};

	const getTypeColor = (type: string) => {
		switch (type?.toUpperCase()) {
			case "ERROR":
				return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
			case "WARNING":
				return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
			case "INFO":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
			case "DEBUG":
				return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
			default:
				return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
		}
	};

	const renderPagination = () => {
		if (!pagination || pagination.total_pages <= 1) return null;

		const pages = [];
		const maxVisiblePages = 5;
		let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
		let endPage = Math.min(pagination.total_pages, startPage + maxVisiblePages - 1);

		if (endPage - startPage + 1 < maxVisiblePages) {
			startPage = Math.max(1, endPage - maxVisiblePages + 1);
		}

		for (let i = startPage; i <= endPage; i++) {
			pages.push(i);
		}

		return (
			<div className="flex items-center justify-between mt-4 text-sm">
				<div className="text-gray-600 dark:text-gray-400">
					Showing {(currentPage - 1) * currentLimit + 1} to {Math.min(currentPage * currentLimit, pagination.total)} of{" "}
					{pagination.total} logs
				</div>
				<div className="flex gap-1">
					<button
						onClick={() => setCurrentPage(1)}
						disabled={currentPage === 1}
						className="px-3 py-1.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded hover:bg-gray-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
						First
					</button>
					<button
						onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
						disabled={currentPage === 1}
						className="px-3 py-1.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded hover:bg-gray-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
						Prev
					</button>

					{pages.map((page) => (
						<button
							key={page}
							onClick={() => setCurrentPage(page)}
							className={`px-3 py-1.5 border rounded transition-colors ${
								currentPage === page
									? "bg-neutral-700 dark:bg-neutral-600 text-white border-neutral-700 dark:border-neutral-600"
									: "text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-800 border-gray-300 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-700"
							}`}>
							{page}
						</button>
					))}

					<button
						onClick={() => setCurrentPage((p) => Math.min(pagination.total_pages, p + 1))}
						disabled={currentPage === pagination.total_pages}
						className="px-3 py-1.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded hover:bg-gray-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
						Next
					</button>
					<button
						onClick={() => setCurrentPage(pagination.total_pages)}
						disabled={currentPage === pagination.total_pages}
						className="px-3 py-1.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded hover:bg-gray-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
						Last
					</button>
				</div>
			</div>
		);
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
					<option value="ERROR">Error</option>
					<option value="WARNING">Warning</option>
					<option value="INFO">Info</option>
					<option value="DEBUG">Debug</option>
				</select>

				{/* Search Bar */}
				<form
					onSubmit={handleSearch}
					className="flex-1 flex items-center gap-2">
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
					<Tooltip content="Search logs">
						<Button
							variant="soft"
							size="md"
							iconOnly
							type="submit">
							<MagnifyingGlassIcon className="w-5 h-5" />
						</Button>
					</Tooltip>
				</form>
			</div>

			{/* Table */}
			{isLoading ? (
				<div className="flex justify-center items-center py-12">
					<div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-500 dark:border-gray-400 border-t-transparent"></div>
				</div>
			) : logs.length === 0 ? (
				<div className="text-center py-12">
					<p className="text-sm text-gray-600 dark:text-gray-400">No logs found for this job.</p>
				</div>
			) : (
				<div className="overflow-hidden border border-gray-200 dark:border-neutral-700 rounded-lg">
					<table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
						<thead className="bg-gray-50 dark:bg-neutral-900">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Type
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Message
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Created
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
							{logs.map((log) => (
								<tr
									key={log.key}
									className={`hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors ${
										newLogKeys.has(log.key) ? "animate-pulse bg-green-50 dark:bg-green-900/20" : ""
									}`}>
									<td className="px-6 py-4 whitespace-nowrap text-sm">
										<span
											className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(log.type || "INFO")}`}>
											{log.type || "INFO"}
										</span>
									</td>
									<td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
										{log.message || "-"}
										{log.data && Object.keys(log.data).length > 0 && (
											<div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
												{JSON.stringify(log.data).substring(0, 100)}
												{JSON.stringify(log.data).length > 100 && "..."}
											</div>
										)}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
										{formatDate(log.created_at, config?.timezone || "+00:00")}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm">
										<div className="flex items-center gap-2">
											<Tooltip content="View Log">
												<button
													onClick={() => navigate(`/logs/${log.key}`)}
													className="p-1.5 rounded-md transition-colors bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-600 hover:text-blue-600 dark:hover:text-blue-400">
													<EyeIcon className="w-4 h-4" />
												</button>
											</Tooltip>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Pagination */}
			{renderPagination()}
		</div>
	);
};

export default LogsTab;
