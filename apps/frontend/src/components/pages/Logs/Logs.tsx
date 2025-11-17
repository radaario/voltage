import { useState, useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Log } from "@/interfaces/log";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import LogsTable from "./LogsTable.tsx";
import { ConfirmModal } from "@/components";
import Tooltip from "@/components/base/Tooltip/Tooltip";
import Button from "@/components/base/Button/Button";
import Alert from "@/components/base/Alert/Alert";
import { MagnifyingGlassIcon, XMarkIcon, ArrowPathIcon, TrashIcon } from "@heroicons/react/24/outline";

interface PaginationInfo {
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	has_more?: boolean;
	next_page?: number | null;
	prev_page?: number | null;
}

const Logs: React.FC = () => {
	const { authToken } = useAuth();
	const queryClient = useQueryClient();

	// states
	const [searchQuery, setSearchQuery] = useState("");
	const [searchInput, setSearchInput] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [currentLimit, setCurrentLimit] = useState(25);
	const [typeFilter, setTypeFilter] = useState<string>("");
	const previousDataRef = useRef<Log[]>([]);
	const [newLogKeys, setNewLogKeys] = useState<Set<string>>(new Set());
	const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

	// Fetch logs with React Query
	const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery<ApiResponse<Log[]>>({
		queryKey: ["logs", currentPage, currentLimit, searchQuery, typeFilter, authToken],
		queryFn: async () => {
			return await api.get<Log[]>("/logs", {
				token: authToken || "",
				page: currentPage,
				limit: currentLimit,
				...(searchQuery && { q: searchQuery }),
				...(typeFilter && { type: typeFilter })
			});
		},
		enabled: !!authToken,
		refetchInterval: 5000 // 5 saniyede bir otomatik refresh
	});

	// Detect new logs when data updates
	useEffect(() => {
		if (!data?.data || currentPage !== 1) {
			return;
		}

		const currentLogs = data.data;
		const previousLogs = previousDataRef.current;

		// Skip first load
		if (previousLogs.length === 0) {
			previousDataRef.current = currentLogs;
			return;
		}

		// Find new logs by comparing keys
		const previousKeys = new Set(previousLogs.map((l) => l.key));
		const newKeys = currentLogs.filter((log) => !previousKeys.has(log.key)).map((log) => log.key);

		if (newKeys.length > 0) {
			setNewLogKeys(new Set(newKeys));
			// Clear animation after 2 seconds
			const timer = setTimeout(() => {
				setNewLogKeys(new Set());
			}, 2000);

			// Update ref
			previousDataRef.current = currentLogs;

			return () => clearTimeout(timer);
		}

		previousDataRef.current = currentLogs;
	}, [dataUpdatedAt, data, currentPage]);

	// Delete all logs mutation
	const deleteAllLogsMutation = useMutation({
		mutationFn: async () => {
			return await api.delete("/logs/all", { token: authToken });
		},
		onSuccess: async () => {
			// Close Delete All modal
			setShowDeleteAllModal(false);
			// Invalidate and refetch logs immediately
			await queryClient.invalidateQueries({ queryKey: ["logs"] });
			await refetch();
			// Auto-dismiss success message after 3 seconds
			setTimeout(() => {
				deleteAllLogsMutation.reset();
			}, 3000);
		}
	});

	// actions
	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		setSearchQuery(searchInput);
		setCurrentPage(1);
	};

	const handleClearSearch = () => {
		setSearchInput("");
		setSearchQuery("");
		setCurrentPage(1);
	};

	const handlePageChange = (newPage: number) => {
		setCurrentPage(newPage);
	};

	const handleLimitChange = (newLimit: number) => {
		setCurrentLimit(newLimit);
		setCurrentPage(1);
	};

	const handleRefresh = () => {
		queryClient.invalidateQueries({ queryKey: ["logs"] });
	};

	const handleDeleteAllLogs = () => {
		setShowDeleteAllModal(true);
	};

	const handleConfirmDeleteAll = () => {
		deleteAllLogsMutation.mutate();
	};

	const handleCloseDeleteAllModal = () => {
		if (!deleteAllLogsMutation.isPending) {
			setShowDeleteAllModal(false);
		}
	};

	const handleTypeFilterChange = (type: string) => {
		setTypeFilter(type);
		setCurrentPage(1);
	};

	// Prepare pagination data
	const pagination: PaginationInfo = {
		total: data?.pagination?.total || 0,
		page: data?.pagination?.page || 1,
		limit: data?.pagination?.limit || 25,
		totalPages: data?.pagination?.total_pages || 0,
		has_more: data?.pagination?.has_more,
		next_page: data?.pagination?.next_page,
		prev_page: data?.pagination?.prev_page
	};

	// renders
	if (isLoading && !data) {
		return (
			<div className="flex justify-center items-center h-64">
				<div className="animate-spin rounded-full h-10 w-10 border-2 border-b-white border-gray-500 dark:border-gray-400"></div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header with Search */}
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<div className="flex items-center gap-3">
					<h3 className="text-2xl font-bold text-gray-900 dark:text-white">System Logs</h3>
					<Tooltip content="Refresh logs">
						<Button
							variant="ghost"
							size="md"
							iconOnly
							onClick={handleRefresh}
							disabled={isLoading}>
							<ArrowPathIcon className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
						</Button>
					</Tooltip>
				</div>
				<div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
					{/* Type Filter */}
					<select
						value={typeFilter}
						onChange={(e) => handleTypeFilterChange(e.target.value)}
						className="h-[38px] px-3 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 sm:text-sm">
						<option value="">All Types</option>
						<option value="INFO">INFO</option>
						<option value="WARNING">WARNING</option>
						<option value="ERROR">ERROR</option>
						<option value="DEBUG">DEBUG</option>
					</select>

					{/* Search Box */}
					<form
						onSubmit={handleSearch}
						className="flex gap-2 flex-1 sm:flex-initial">
						<div className="relative flex-1 sm:w-64">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
							</div>
							<input
								type="text"
								value={searchInput}
								onChange={(e) => setSearchInput(e.target.value)}
								placeholder="Search logs..."
								className="block w-full h-[38px] pl-10 pr-10 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 sm:text-sm"
							/>
							{searchInput && (
								<button
									type="button"
									onClick={handleClearSearch}
									className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
									<XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
								</button>
							)}
						</div>
						<Tooltip content="Search logs">
							<Button
								variant="soft"
								size="md"
								iconOnly
								type="submit">
								<MagnifyingGlassIcon className="h-5 w-5" />
							</Button>
						</Tooltip>
					</form>

					{/* Delete All Button */}
					<Tooltip content="Delete all logs">
						<Button
							variant="soft"
							size="md"
							iconOnly
							onClick={handleDeleteAllLogs}
							disabled={deleteAllLogsMutation.isPending || (data?.data?.length || 0) === 0}
							isLoading={deleteAllLogsMutation.isPending}>
							<TrashIcon className="h-5 w-5 text-red-600" />
						</Button>
					</Tooltip>
				</div>
			</div>

			{/* Error Message */}
			{(error || deleteAllLogsMutation.error) && (
				<Alert variant="error">
					{error instanceof Error
						? error.message
						: deleteAllLogsMutation.error instanceof Error
							? deleteAllLogsMutation.error.message
							: "An error occurred"}
				</Alert>
			)}

			{/* Success Message */}
			{deleteAllLogsMutation.isSuccess && (
				<Alert
					variant="error"
					onClose={() => deleteAllLogsMutation.reset()}>
					All logs deleted successfully!
				</Alert>
			)}

			{/* Table */}
			<div className="bg-gray-100 dark:bg-gray-900 shadow-md rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700">
				<LogsTable
					data={data?.data || []}
					loading={isLoading}
					pagination={pagination}
					onPageChange={handlePageChange}
					onLimitChange={handleLimitChange}
					newLogKeys={newLogKeys}
				/>
			</div>

			{/* Delete All Confirmation Modal */}
			{showDeleteAllModal && (
				<ConfirmModal
					isOpen={showDeleteAllModal}
					onClose={handleCloseDeleteAllModal}
					onConfirm={handleConfirmDeleteAll}
					title="Delete All Logs"
					message={
						<>
							Are you sure you want to delete <strong>ALL logs</strong>? This action cannot be undone and will permanently
							remove all log entries from the system.
						</>
					}
					confirmText="Delete All Logs"
					variant="danger"
					isLoading={deleteAllLogsMutation.isPending}
					loadingText="Deleting"
				/>
			)}

			{/* Nested modal outlet */}
			<Outlet />
		</div>
	);
};

export default Logs;
