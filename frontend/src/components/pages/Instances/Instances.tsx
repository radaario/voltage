import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Outlet } from "react-router-dom";
import type { Instance } from "@/interfaces/instance";
import { useAuth } from "@/hooks/useAuth";
import InstancesTable from "./InstancesTable";
import { MagnifyingGlassIcon, XMarkIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

interface InstancesResponse {
	data: Instance[];
	metadata: {
		status: boolean;
	};
}

const Instances: React.FC = () => {
	const { authToken } = useAuth();

	// states
	const [searchQuery, setSearchQuery] = useState("");
	const [searchInput, setSearchInput] = useState("");

	// Fetch instances with React Query
	const { data, isLoading, error, refetch } = useQuery<InstancesResponse>({
		queryKey: ["instances", authToken],
		queryFn: async () => {
			const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/instances?token=${authToken}`);
			if (!response.ok) {
				throw new Error("Failed to fetch instances");
			}
			return response.json();
		},
		enabled: !!authToken,
		refetchInterval: 5000 // Auto refresh every 5 seconds
	});

	// handlers
	const handleSearchSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setSearchQuery(searchInput);
	};

	const handleClearSearch = () => {
		setSearchInput("");
		setSearchQuery("");
	};

	const handleRefresh = () => {
		refetch();
	};

	// Filter instances by search query
	const filteredInstances =
		data?.data?.filter((instance) => {
			if (!searchQuery) return true;
			const query = searchQuery.toLowerCase();
			return (
				instance.key.toLowerCase().includes(query) ||
				instance.status.toLowerCase().includes(query) ||
				instance.system?.hostname?.toLowerCase().includes(query)
			);
		}) || [];

	// renders
	if (isLoading && !data) {
		return (
			<div className="flex justify-center items-center min-h-[400px]">
				<div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
				<p className="text-red-800 dark:text-red-200">Failed to load instances. Please try again.</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header with Search */}
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<div className="flex items-center gap-3">
					<h3 className="text-2xl font-bold text-gray-900 dark:text-white">Instances</h3>
					<button
						type="button"
						onClick={handleRefresh}
						title="Refresh"
						disabled={isLoading}
						className={`p-2 -mb-1 rounded-md transition-all ${
							isLoading
								? "text-gray-400 dark:text-gray-500 cursor-not-allowed"
								: "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400"
						}`}>
						<ArrowPathIcon className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
					</button>
				</div>
				<div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
					{/* Search Box */}
					<form
						onSubmit={handleSearchSubmit}
						className="flex gap-2 flex-1 sm:flex-initial">
						<div className="relative flex-1 sm:w-64">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
							</div>
							<input
								type="text"
								value={searchInput}
								onChange={(e) => setSearchInput(e.target.value)}
								placeholder="Search instances..."
								className="block w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
						<button
							type="submit"
							title="Search"
							className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
							<MagnifyingGlassIcon className="h-5 w-5" />
						</button>
					</form>
				</div>
			</div>

			{/* Instances Table */}
			<div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
				<InstancesTable
					data={filteredInstances}
					loading={isLoading}
				/>
			</div>

			{/* Route-based Instance Detail Modal */}
			<Outlet />
		</div>
	);
};

export default Instances;
