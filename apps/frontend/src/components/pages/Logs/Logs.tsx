import { useState, useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Log } from "@/interfaces/log";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import LogsTable from "@/components/pages/Logs/Table/Table";
import { ConfirmModal, Alert, Button, Tooltip, SearchInput, LoadingSpinner, Page, ErrorAlert } from "@/components";
import { TrashIcon } from "@heroicons/react/24/outline";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";

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
	const { pageResetCounters } = useGlobalStateContext();

	// states
	const [searchQuery, setSearchQuery] = useState("");
	const [searchInput, setSearchInput] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [currentLimit, setCurrentLimit] = useState(10);
	const [typeFilter, setTypeFilter] = useState<string>("");
	const previousDataRef = useRef<Log[]>([]);
	const [newLogKeys, setNewLogKeys] = useState<Set<string>>(new Set());
	const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

	// queries
	const {
		data: logsResponse,
		isLoading,
		error,
		refetch,
		dataUpdatedAt
	} = useQuery<ApiResponse<Log[]>>({
		queryKey: ["logs", currentPage, currentLimit, searchQuery, typeFilter, authToken],
		queryFn: () =>
			api.get<Log[]>("/logs", {
				token: authToken || "",
				page: currentPage,
				limit: currentLimit,
				...(searchQuery && { q: searchQuery }),
				...(typeFilter && { type: typeFilter })
			}),
		enabled: !!authToken,
		refetchInterval: 5000, // 5 saniyede bir otomatik refresh
		placeholderData: (previousData) => previousData
	});

	// mutations
	const deleteAllLogsMutation = useMutation({
		mutationFn: async () => {
			return await api.delete("/logs", { token: authToken, all: "true" });
		},
		onSuccess: async () => {
			setShowDeleteAllModal(false);
			await queryClient.invalidateQueries({ queryKey: ["logs"] });
			await refetch();
		}
	});

	// Auto-reset mutation after success
	useEffect(() => {
		if (deleteAllLogsMutation.isSuccess) {
			const timer = setTimeout(() => {
				deleteAllLogsMutation.reset();
			}, 3000);
			return () => clearTimeout(timer);
		}
	}, [deleteAllLogsMutation.isSuccess]);

	// actions
	const handleClearSearch = () => {
		setSearchInput("");
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

	// effects
	useEffect(() => {
		// Only detect new logs on first page
		if (!logsResponse?.data || currentPage !== 1) {
			return;
		}

		const currentLogs = logsResponse.data;
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
	}, [dataUpdatedAt, currentPage]); // Removed logsResponse from deps - dataUpdatedAt is enough

	useEffect(() => {
		const timer = setTimeout(() => {
			setSearchQuery(searchInput);
		}, 500);

		return () => clearTimeout(timer);
	}, [searchInput]);

	useEffect(() => {
		if (searchQuery !== "") {
			setCurrentPage(1);
		}
	}, [searchQuery]);

	// reset pagination when header link is clicked from header
	useEffect(() => {
		currentPage ? refetch() : setCurrentPage(1);
	}, [pageResetCounters]);

	// Prepare pagination data
	const pagination: PaginationInfo = {
		total: logsResponse?.pagination?.total || 0,
		page: logsResponse?.pagination?.page || 1,
		limit: logsResponse?.pagination?.limit || 25,
		totalPages: logsResponse?.pagination?.total_pages || 0,
		has_more: logsResponse?.pagination?.has_more,
		next_page: logsResponse?.pagination?.next_page,
		prev_page: logsResponse?.pagination?.prev_page
	};

	// renders
	if (isLoading && !logsResponse) {
		return <LoadingSpinner />;
	}

	return (
		<Page>
			{/* Page Header */}
			<Page.Header
				title="Logs"
				onRefresh={handleRefresh}
				isRefreshing={isLoading}>
				{/* Type Filter */}
				<select
					value={typeFilter}
					onChange={(e) => handleTypeFilterChange(e.target.value)}
					className="h-[38px] px-3 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 sm:text-sm">
					<option value="">All Types</option>
					<option value="INFO">Info</option>
					<option value="WARNING">Warning</option>
					<option value="ERROR">Error</option>
				</select>

				<SearchInput
					value={searchInput}
					onChange={setSearchInput}
					onClear={handleClearSearch}
					placeholder="Search logs..."
					className="h-[38px]"
				/>

				<Tooltip content="Delete All">
					<Button
						variant="soft"
						hover="danger"
						size="md"
						iconOnly
						onClick={handleDeleteAllLogs}
						disabled={deleteAllLogsMutation.isPending || (logsResponse?.data?.length || 0) === 0}
						isLoading={deleteAllLogsMutation.isPending}>
						<TrashIcon className="h-5 w-5" />
					</Button>
				</Tooltip>
			</Page.Header>
			{/* Error Alert */}
			<ErrorAlert errors={[error, deleteAllLogsMutation.error]} />

			{/* Success Message */}
			{deleteAllLogsMutation.isSuccess && (
				<Alert
					variant="error"
					onClose={() => deleteAllLogsMutation.reset()}>
					All logs deleted successfully!
				</Alert>
			)}

			{/* Logs Table */}
			<LogsTable
				data={logsResponse?.data || []}
				loading={isLoading}
				pagination={pagination}
				onPageChange={handlePageChange}
				onLimitChange={handleLimitChange}
				newLogKeys={newLogKeys}
			/>

			{/* Delete All Confirmation Modal */}
			{showDeleteAllModal && (
				<ConfirmModal
					isOpen={showDeleteAllModal}
					onClose={handleCloseDeleteAllModal}
					onConfirm={handleConfirmDeleteAll}
					title="Delete All Logs"
					message={
						<>
							<p className="mb-4">
								Are you sure you want to delete <strong className="text-red-600 dark:text-red-400">all logs</strong>?
							</p>
							<p className="font-semibold text-red-600 dark:text-red-400">This action cannot be undone!</p>
						</>
					}
					confirmText="Delete All"
					variant="danger"
					isLoading={deleteAllLogsMutation.isPending}
					loadingText="Deleting"
				/>
			)}

			{/* Nested modal outlet */}
			<Outlet />
		</Page>
	);
};

export default Logs;
