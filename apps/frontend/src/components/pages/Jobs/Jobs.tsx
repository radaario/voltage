import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Outlet } from "react-router-dom";
import type { Job } from "@/interfaces/job";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import { api, ApiResponse } from "@/utils";
import { testJobPayload } from "@/mocks/testJobPayload";
import JobsTable from "@/components/pages/Jobs/Table/Table";
import { ConfirmModal, Button, Tooltip, SearchInput, LoadingSpinner, Page, ErrorAlert, JsonViewer } from "@/components";
import { TrashIcon } from "@heroicons/react/24/outline";

interface PaginationInfo {
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	has_more?: boolean;
	next_page?: number | null;
	prev_page?: number | null;
}

const Jobs: React.FC = () => {
	const { authToken } = useAuth();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { pageResetCounters } = useGlobalStateContext();

	// states
	const [searchQuery, setSearchQuery] = useState("");
	const [searchInput, setSearchInput] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [currentLimit, setCurrentLimit] = useState(6);
	const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
	const [jobToRetry, setJobToRetry] = useState<Job | null>(null);
	const previousDataRef = useRef<Job[]>([]);
	const [newJobKeys, setNewJobKeys] = useState<Set<string>>(new Set());
	const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
	const [showCreateJobModal, setShowCreateJobModal] = useState(false);

	// queries
	const {
		data: jobsResponse,
		isLoading,
		isFetching,
		error,
		refetch,
		dataUpdatedAt
	} = useQuery<ApiResponse<Job[]>>({
		queryKey: ["jobs", currentPage, currentLimit, searchQuery, authToken],
		queryFn: () =>
			api.get<Job[]>("/jobs", {
				token: authToken || "",
				page: currentPage,
				limit: currentLimit,
				...(searchQuery && { q: searchQuery })
			}),
		enabled: !!authToken,
		refetchInterval: 5000,
		placeholderData: (previousData) => previousData
	});

	// mutations
	const createJobMutation = useMutation({
		mutationFn: async () => {
			return await api.put("/jobs", testJobPayload, { params: { token: authToken } });
		},
		onSuccess: () => {
			setShowCreateJobModal(false);
			setCurrentPage(1);
			queryClient.invalidateQueries({ queryKey: ["jobs"] });
		}
	});

	const deleteJobMutation = useMutation({
		mutationFn: async (jobKey: string) => {
			return await api.delete("/jobs", { token: authToken, job_key: jobKey });
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["jobs"] });
			await refetch();
		}
	});

	const retryJobMutation = useMutation({
		mutationFn: async (jobKey: string) => {
			return await api.post("/jobs/retry", null, {
				params: { token: authToken, job_key: jobKey }
			});
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["jobs"] });
			await refetch();
		}
	});

	const deleteAllJobsMutation = useMutation({
		mutationFn: async () => {
			return await api.delete("/jobs", { token: authToken, all: "true", hard_delete: "true" });
		},
		onSuccess: async () => {
			setShowDeleteAllModal(false);
			await queryClient.invalidateQueries({ queryKey: ["jobs"] });
			await refetch();
		}
	});

	// Auto-reset mutation after success
	useEffect(() => {
		if (deleteAllJobsMutation.isSuccess) {
			const timer = setTimeout(() => {
				deleteAllJobsMutation.reset();
			}, 3000);
			return () => clearTimeout(timer);
		}
	}, [deleteAllJobsMutation.isSuccess]);

	// reset pagination when header link is clicked from header
	useEffect(() => {
		currentPage ? refetch() : setCurrentPage(1);
	}, [pageResetCounters]);

	// data
	const pagination: PaginationInfo = {
		total: jobsResponse?.pagination?.total || 0,
		page: jobsResponse?.pagination?.page || 1,
		limit: jobsResponse?.pagination?.limit || 6,
		totalPages: jobsResponse?.pagination?.total_pages || 0,
		has_more: jobsResponse?.pagination?.has_more,
		next_page: jobsResponse?.pagination?.next_page,
		prev_page: jobsResponse?.pagination?.prev_page
	};

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

	const handleCreateExampleJob = () => {
		setShowCreateJobModal(true);
	};

	const handleConfirmCreateJob = () => {
		createJobMutation.mutate();
	};

	const handleCloseCreateJobModal = () => {
		if (!createJobMutation.isPending) {
			setShowCreateJobModal(false);
		}
	};

	const handleRefresh = () => {
		queryClient.invalidateQueries({ queryKey: ["jobs"] });
	};

	const handleViewJob = (job: Job) => {
		navigate(`/jobs/${job.key}/info`);
	};

	const handleDeleteJob = (job: Job) => {
		setJobToDelete(job);
	};

	const handleRetryJob = (job: Job) => {
		setJobToRetry(job);
	};

	const handleConfirmRetry = () => {
		if (jobToRetry) {
			retryJobMutation.mutate(jobToRetry.key);
			setJobToRetry(null);
		}
	};

	const handleCloseRetryModal = () => {
		if (!retryJobMutation.isPending) {
			setJobToRetry(null);
		}
	};

	const handleConfirmDelete = () => {
		if (jobToDelete) {
			deleteJobMutation.mutate(jobToDelete.key);
			setJobToDelete(null);
		}
	};

	const handleCloseDeleteModal = () => {
		if (!deleteJobMutation.isPending) {
			setJobToDelete(null);
		}
	};

	const handleConfirmDeleteAll = () => {
		deleteAllJobsMutation.mutate();
	};

	const handleCloseDeleteAllModal = () => {
		if (!deleteAllJobsMutation.isPending) {
			setShowDeleteAllModal(false);
		}
	};

	const handleDeleteAllJobs = () => {
		setShowDeleteAllModal(true);
	};

	// effects
	useEffect(() => {
		// Only detect new jobs on first page
		if (!jobsResponse?.data || currentPage !== 1) {
			return;
		}

		const currentJobs = jobsResponse.data;
		const previousJobs = previousDataRef.current;

		// Skip first load
		if (previousJobs.length === 0) {
			previousDataRef.current = currentJobs;
			return;
		}

		// Find new jobs by comparing keys
		const previousKeys = new Set(previousJobs.map((j) => j.key));
		const newKeys = currentJobs.filter((job: Job) => !previousKeys.has(job.key)).map((job: Job) => job.key);

		if (newKeys.length > 0) {
			setNewJobKeys(new Set(newKeys));
			// Clear animation after 2 seconds
			const timer = setTimeout(() => {
				setNewJobKeys(new Set());
			}, 2000);

			// Update ref
			previousDataRef.current = currentJobs;

			return () => clearTimeout(timer);
		}

		previousDataRef.current = currentJobs;
	}, [dataUpdatedAt, currentPage]); // Removed jobsResponse from deps - dataUpdatedAt is enough

	useEffect(() => {
		const timer = setTimeout(() => {
			setSearchQuery(searchInput);
			if (searchInput !== "") {
				setCurrentPage(1);
			}
		}, 500);

		return () => clearTimeout(timer);
	}, [searchInput]);

	// renders
	if (isLoading && !jobsResponse) {
		return <LoadingSpinner />;
	}

	return (
		<Page>
			{/* Page Header */}
			<Page.Header
				title="Jobs"
				onRefresh={handleRefresh}
				isRefreshing={isLoading || isFetching}>
				<SearchInput
					value={searchInput}
					onChange={setSearchInput}
					onClear={handleClearSearch}
					placeholder="Search jobs..."
				/>
				<Button
					variant="secondary"
					size="sm"
					onClick={handleCreateExampleJob}>
					+ Create Test Job
				</Button>
				<Tooltip content="Delete All">
					<Button
						variant="soft"
						hover="danger"
						size="md"
						iconOnly
						onClick={handleDeleteAllJobs}
						disabled={deleteAllJobsMutation.isPending || (jobsResponse?.data?.length || 0) === 0}
						isLoading={deleteAllJobsMutation.isPending}>
						<TrashIcon className="h-5 w-5 " />
					</Button>
				</Tooltip>
			</Page.Header>

			{/* Error Alert */}
			<ErrorAlert errors={[error, createJobMutation.error, retryJobMutation.error]} />

			{/* Jobs Table */}
			<JobsTable
				data={jobsResponse?.data || []}
				loading={isLoading}
				pagination={pagination}
				onPageChange={handlePageChange}
				onLimitChange={handleLimitChange}
				onViewJob={handleViewJob}
				onDeleteJob={handleDeleteJob}
				onRetryJob={handleRetryJob}
				newJobKeys={newJobKeys}
			/>

			{/* Delete Confirmation Modal */}
			{jobToDelete && (
				<ConfirmModal
					isOpen={!!jobToDelete}
					onClose={handleCloseDeleteModal}
					onConfirm={handleConfirmDelete}
					title="Delete Job"
					message={
						<>
							<p className="mb-4">Are you sure you want to delete this job?</p>
							<ul className="list-disc list-inside space-y-1 mb-4 text-sm">
								<li>{jobToDelete.key}</li>
							</ul>
							<p className="font-semibold text-red-600 dark:text-red-400">This action cannot be undone!</p>
						</>
					}
					confirmText="Delete"
					variant="danger"
					isLoading={deleteJobMutation.isPending}
					loadingText="Deleting"
				/>
			)}

			{/* Retry Confirmation Modal */}
			{jobToRetry && (
				<ConfirmModal
					isOpen={!!jobToRetry}
					onClose={handleCloseRetryModal}
					onConfirm={handleConfirmRetry}
					title="Retry Job"
					message={
						<>
							<p className="mb-4">Are you sure you want to retry this job?</p>
							<ul className="list-disc list-inside space-y-1 mb-4 text-sm">
								<li>{jobToRetry.key}</li>
							</ul>
						</>
					}
					confirmText="Retry"
					variant="info"
					isLoading={retryJobMutation.isPending}
					loadingText="Retrying"
				/>
			)}

			{/* Delete All Confirmation Modal */}
			{showDeleteAllModal && (
				<ConfirmModal
					isOpen={showDeleteAllModal}
					onClose={handleCloseDeleteAllModal}
					onConfirm={handleConfirmDeleteAll}
					title="Delete All Jobs"
					message={
						<>
							<p className="mb-4">
								Are you sure you want to delete <strong className="text-red-600 dark:text-red-400">all jobs</strong>?
							</p>
							<p className="font-semibold text-red-600 dark:text-red-400">This action cannot be undone!</p>
						</>
					}
					confirmText="Delete All"
					variant="danger"
					isLoading={deleteAllJobsMutation.isPending}
					loadingText="Deleting"
				/>
			)}

			{/* Create Test Job Modal */}
			{showCreateJobModal && (
				<ConfirmModal
					isOpen={showCreateJobModal}
					onClose={handleCloseCreateJobModal}
					onConfirm={handleConfirmCreateJob}
					title="Test Job Payload"
					size="4xl"
					message={
						<div className="space-y-4">
							<code className="block px-3 py-2 bg-gray-100 dark:bg-neutral-700 rounded text-sm">PUT /jobs</code>
							<div className="max-h-130 overflow-y-auto">
								<JsonViewer data={testJobPayload} />
							</div>
						</div>
					}
					confirmText="Post"
					variant="info"
					noIcon={true}
					isLoading={createJobMutation.isPending}
					loadingText="Posting"
				/>
			)}

			{/* Route-based Job Detail Modal */}
			<Outlet />
		</Page>
	);
};

export default Jobs;
