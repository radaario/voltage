import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Outlet } from "react-router-dom";
import type { Job } from "@/interfaces/job";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import JobsTable from "./JobsTable";
import DeleteConfirmModal from "@/components/modals/DeleteConfirmModal/DeleteConfirmModal";
import { ConfirmModal, Button, Tooltip, SearchInput, LoadingSpinner, PageHeader, ErrorAlert } from "@/components";
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

	// queries
	const {
		data: jobsResponse,
		isLoading,
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
			const payload = {
				input: {
					type: "HTTP",
					url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_20MB.mp4"
				},
				outputs: [
					{
						type: "VIDEO",
						format: "MP4",
						path: "Big_Buck_Bunny_1080_10s_20MB.mp4"
					},
					{
						type: "AUDIO",
						format: "MP3",
						path: "Big_Buck_Bunny_1080_10s_20MB.mp3"
					},
					{
						type: "THUMBNAIL",
						format: "PNG",
						path: "Big_Buck_Bunny_1080_10s_20MB.png"
					}
				],
				destination: {
					service: "HTTPS",
					method: "POST",
					url: "https://httpbin.org/post",
					headers: {
						"X-Output-Type": "720p-webm"
					}
				},
				notification: {
					type: "HTTP",
					url: "https://httpbin.org/post"
				},
				metadata: { client: "FRONTEND", example: true, timestamp: new Date().toISOString() }
			};

			return await api.put("/jobs", payload, { params: { token: authToken } });
		},
		onSuccess: () => {
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
			return await api.delete("/jobs/all", { token: authToken });
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
		createJobMutation.mutate();
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
		<div className="space-y-6">
			{/* Header with Search */}
			<PageHeader
				title="Jobs"
				onRefresh={handleRefresh}
				isRefreshing={isLoading}>
				<SearchInput
					value={searchInput}
					onChange={setSearchInput}
					onClear={handleClearSearch}
					placeholder="Search jobs..."
				/>

				<Button
					variant="secondary"
					size="sm"
					onClick={handleCreateExampleJob}
					disabled={createJobMutation.isPending}
					isLoading={createJobMutation.isPending}>
					{createJobMutation.isPending ? "Creating…" : "+ Create Test Job"}
				</Button>

				<Tooltip content="Delete All Jobs">
					<Button
						variant="soft"
						size="md"
						iconOnly
						onClick={handleDeleteAllJobs}
						disabled={deleteAllJobsMutation.isPending || (jobsResponse?.data?.length || 0) === 0}
						isLoading={deleteAllJobsMutation.isPending}>
						<TrashIcon className="h-5 w-5 text-red-600 dark:text-white" />
					</Button>
				</Tooltip>
			</PageHeader>

			<ErrorAlert errors={[error, createJobMutation.error, retryJobMutation.error]} />

			{/* Table */}
			<div className="bg-gray-100 dark:bg-neutral-800 shadow-md rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700">
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
			</div>

			{/* Delete Confirmation Modal */}
			{jobToDelete && (
				<DeleteConfirmModal
					isOpen={!!jobToDelete}
					onClose={handleCloseDeleteModal}
					onConfirm={handleConfirmDelete}
					title="Delete Job"
					message={
						<>
							Are you sure you want to delete{" "}
							{jobToDelete.input?.file_name || jobToDelete.input?.url?.split("/").pop() ? (
								<>
									<strong>{jobToDelete.input?.file_name || jobToDelete.input?.url?.split("/").pop()}</strong>
									<div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">({jobToDelete.key})</div>
								</>
							) : (
								<strong>{jobToDelete.key}</strong>
							)}
							? This action cannot be undone.
						</>
					}
					confirmText="Delete Job"
					isDeleting={deleteJobMutation.isPending}
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
							Are you sure you want to retry{" "}
							{jobToRetry.input?.file_name || jobToRetry.input?.url?.split("/").pop() ? (
								<>
									<strong>{jobToRetry.input?.file_name || jobToRetry.input?.url?.split("/").pop()}</strong>
									<div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">({jobToRetry.key})</div>
								</>
							) : (
								<strong>{jobToRetry.key}</strong>
							)}
							?
						</>
					}
					confirmText="Retry Job"
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
							Are you sure you want to delete <strong>ALL jobs</strong>? This action cannot be undone and will permanently
							remove all Job entries from the system.
						</>
					}
					confirmText="Delete All Jobs"
					variant="danger"
					isLoading={deleteAllJobsMutation.isPending}
					loadingText="Deleting"
				/>
			)}

			{/* Route-based Job Detail Modal */}
			<Outlet />
		</div>
	);
};

export default Jobs;
