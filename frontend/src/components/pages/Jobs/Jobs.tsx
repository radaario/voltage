import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Outlet } from "react-router-dom";
import type { Job } from "@/interfaces/job";
import { useAuth } from "@/hooks/useAuth";
import JobsTable from "./JobsTable";
import DeleteConfirmModal from "@/components/modals/DeleteConfirmModal/DeleteConfirmModal";
import Tooltip from "@/components/base/Tooltip/Tooltip";
import { MagnifyingGlassIcon, XMarkIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

interface PaginationInfo {
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	has_more?: boolean;
	next_page?: number | null;
	prev_page?: number | null;
}

interface JobsResponse {
	data: Job[];
	pagination: {
		total: number;
		page: number;
		limit: number;
		total_pages: number;
		has_more?: boolean;
		next_page?: number | null;
		prev_page?: number | null;
	};
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
	const previousDataRef = useRef<Job[]>([]);
	const [newJobKeys, setNewJobKeys] = useState<Set<string>>(new Set());

	// Fetch jobs with React Query
	const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery<JobsResponse>({
		queryKey: ["jobs", currentPage, currentLimit, searchQuery, authToken],
		queryFn: async () => {
			const params = new URLSearchParams();
			params.append("token", authToken || "");
			params.append("page", String(currentPage));
			params.append("limit", String(currentLimit));
			if (searchQuery) {
				params.append("q", searchQuery);
			}

			const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/jobs?${params}`);

			if (!response.ok) {
				throw new Error("Failed to fetch jobs");
			}

			return response.json();
		},
		enabled: !!authToken,
		refetchInterval: 5000 // 5 saniyede bir otomatik refresh
	});

	// Detect new jobs when data updates
	useEffect(() => {
		if (!data?.data || currentPage !== 1) {
			return;
		}

		const currentJobs = data.data;
		const previousJobs = previousDataRef.current;

		// Skip first load
		if (previousJobs.length === 0) {
			previousDataRef.current = currentJobs;
			return;
		}

		// Find new jobs by comparing keys
		const previousKeys = new Set(previousJobs.map((j) => j.key));
		const newKeys = currentJobs.filter((job) => !previousKeys.has(job.key)).map((job) => job.key);

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
	}, [dataUpdatedAt, data, currentPage]);

	// Create job mutation
	const createJobMutation = useMutation({
		mutationFn: async () => {
			const payload = {
				input: {
					service: "HTTPS",
					// url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4"
					url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_20MB.mp4"
				},
				outputs: [
					{
						container: "mp4",
						videoCodec: "libx264",
						audioCodec: "aac",
						destination: {
							service: "HTTPS",
							method: "POST",
							url: "https://httpbin.org/post"
						}
					}
				],
				metadata: [{ from: "dashboard", example: true }]
			};

			const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/jobs?token=${authToken}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload)
			});

			if (!resp.ok) {
				const errText = await resp.text();
				throw new Error(errText || "Failed to create job");
			}

			return resp.json();
		},
		onSuccess: () => {
			setCurrentPage(1);
			// Invalidate and refetch jobs
			queryClient.invalidateQueries({ queryKey: ["jobs"] });
		}
	});

	// Delete job mutation
	const deleteJobMutation = useMutation({
		mutationFn: async (jobKey: string) => {
			const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/jobs/${jobKey}?token=${authToken}`, {
				method: "DELETE"
			});

			if (!resp.ok) {
				const errText = await resp.text();
				throw new Error(errText || "Failed to delete job");
			}

			// 204 No Content doesn't have a body
			if (resp.status === 204) {
				return null;
			}

			return resp.json();
		},
		onSuccess: async () => {
			// Invalidate and refetch jobs immediately
			await queryClient.invalidateQueries({ queryKey: ["jobs"] });
			await refetch();
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

	const handleCreateExampleJob = () => {
		createJobMutation.mutate();
	};

	const handleRefresh = () => {
		queryClient.invalidateQueries({ queryKey: ["jobs"] });
	};

	const handleViewJob = (job: Job) => {
		navigate(`/jobs/${job.key}/job`);
	};

	const handleDeleteJob = (job: Job) => {
		setJobToDelete(job);
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

	// Prepare pagination data
	const pagination: PaginationInfo = {
		total: data?.pagination?.total || 0,
		page: data?.pagination?.page || 1,
		limit: data?.pagination?.limit || 6,
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
					<h3 className="text-2xl font-bold text-gray-900 dark:text-white">Latest jobs</h3>
					<Tooltip content="Refresh jobs">
						<button
							type="button"
							onClick={handleRefresh}
							disabled={isLoading}
							className={`p-2 -mb-1 rounded-md transition-all ${
								isLoading
									? "text-gray-400 dark:text-gray-500 cursor-not-allowed"
									: "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-white"
							}`}>
							<ArrowPathIcon className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
						</button>
					</Tooltip>
				</div>
				<div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
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
								placeholder="Search jobs..."
								className="block w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-neutral-600 rounded-md leading-5 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 sm:text-sm"
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
						<Tooltip content="Search jobs">
							<button
								type="submit"
								className="p-2 bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors">
								<MagnifyingGlassIcon className="h-5 w-5" />
							</button>
						</Tooltip>
					</form>

					{/* Create Button */}
					<button
						type="button"
						onClick={handleCreateExampleJob}
						disabled={createJobMutation.isPending}
						className={`px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white whitespace-nowrap ${createJobMutation.isPending ? "bg-indigo-300 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors`}>
						{createJobMutation.isPending ? "Creating…" : "+ Create Test Job"}
					</button>
				</div>
			</div>

			{/* Error Message */}
			{(error || createJobMutation.error) && (
				<div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
					<p className="text-sm text-red-800 dark:text-red-200">
						{error instanceof Error
							? error.message
							: createJobMutation.error instanceof Error
								? createJobMutation.error.message
								: "An error occurred"}
					</p>
				</div>
			)}

			{/* Table */}
			<div className="bg-gray-100 dark:bg-gray-900 shadow-md rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700">
				<JobsTable
					data={data?.data || []}
					loading={isLoading}
					pagination={pagination}
					onPageChange={handlePageChange}
					onLimitChange={handleLimitChange}
					onViewJob={handleViewJob}
					onDeleteJob={handleDeleteJob}
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

			{/* Route-based Job Detail Modal */}
			<Outlet />
		</div>
	);
};

export default Jobs;
