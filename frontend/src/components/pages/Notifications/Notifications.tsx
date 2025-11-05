import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import type { NotificationsResponse } from "@/interfaces/notification";
import NotificationsTable from "@/components/pages/Notifications/NotificationsTable";
import { MagnifyingGlassIcon, XMarkIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

const Notifications: React.FC = () => {
	const { authToken } = useAuth();

	// states
	const [searchQuery, setSearchQuery] = useState("");
	const [searchInput, setSearchInput] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [currentLimit, setCurrentLimit] = useState(25);

	// Fetch notifications with React Query
	const { data, isLoading, error, refetch } = useQuery<NotificationsResponse>({
		queryKey: ["notifications", currentPage, currentLimit, searchQuery, authToken],
		queryFn: async () => {
			const params = new URLSearchParams();
			params.append("token", authToken || "");
			params.append("page", String(currentPage));
			params.append("limit", String(currentLimit));
			if (searchQuery) {
				params.append("q", searchQuery);
			}

			const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/jobs/notifications?${params}`);
			if (!response.ok) {
				throw new Error("Failed to fetch notifications");
			}
			return await response.json();
		},
		enabled: !!authToken,
		refetchInterval: 5000
	});

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

	const notifications = data?.data || [];
	const pagination = data?.pagination;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Notifications</h1>
					<p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Monitor and manage job notification events</p>
				</div>
				<button
					onClick={() => refetch()}
					className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
					title="Refresh">
					<ArrowPathIcon className="w-5 h-5" />
				</button>
			</div>

			{/* Search Bar */}
			<div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
				<form
					onSubmit={handleSearch}
					className="flex gap-2">
					<div className="relative flex-1">
						<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
							<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
						</div>
						<input
							type="text"
							value={searchInput}
							onChange={(e) => setSearchInput(e.target.value)}
							placeholder="Search notifications by key, payload, or outcome..."
							className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neutral-500 dark:focus:ring-neutral-400 focus:border-transparent"
						/>
						{searchInput && (
							<button
								type="button"
								onClick={handleClearSearch}
								className="absolute inset-y-0 right-0 pr-3 flex items-center">
								<XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
							</button>
						)}
					</div>
					<button
						type="submit"
						className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors">
						Search
					</button>
				</form>
			</div>

			{/* Error State */}
			{error && (
				<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
					<p className="text-sm text-red-800 dark:text-red-400">
						Error loading notifications: {error instanceof Error ? error.message : "Unknown error"}
					</p>
				</div>
			)}

			{/* Notifications Table */}
			<div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 overflow-hidden">
				<NotificationsTable
					notifications={notifications}
					isLoading={isLoading}
					pagination={pagination}
					currentPage={currentPage}
					setCurrentPage={setCurrentPage}
					currentLimit={currentLimit}
					setCurrentLimit={setCurrentLimit}
				/>
			</div>
		</div>
	);
};

export default Notifications;
