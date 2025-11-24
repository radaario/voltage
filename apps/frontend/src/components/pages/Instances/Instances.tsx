import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Outlet } from "react-router-dom";
import type { Instance } from "@/interfaces/instance";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import InstancesTable from "./InstancesTable";
import { MagnifyingGlassIcon, XMarkIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { Alert, Button, Tooltip } from "@/components";

const Instances: React.FC = () => {
	const { authToken } = useAuth();

	// states
	const [searchQuery, setSearchQuery] = useState("");
	const [searchInput, setSearchInput] = useState("");

	// Fetch instances with React Query
	const {
		data: instancesResponse,
		isLoading,
		error,
		refetch
	} = useQuery<ApiResponse<Instance[]>>({
		queryKey: ["instances", searchQuery, authToken],
		queryFn: () => api.get<Instance[]>("/instances", { token: authToken, ...(searchQuery && { q: searchQuery }) }),
		enabled: !!authToken,
		refetchInterval: 5000, // Auto refresh every 5 seconds
		placeholderData: (previousData) => previousData
	});

	// Debounce search input (500ms)
	useEffect(() => {
		const timer = setTimeout(() => {
			setSearchQuery(searchInput);
		}, 500);

		return () => clearTimeout(timer);
	}, [searchInput]);

	// handlers
	const handleClearSearch = () => {
		setSearchInput("");
	};

	const handleRefresh = () => {
		refetch();
	};

	// Filter instances by search query
	const filteredInstances = instancesResponse?.data || [];

	// renders
	if (isLoading && !instancesResponse) {
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
					<h3 className="text-2xl font-bold text-gray-900 dark:text-white">Instances</h3>
					<Tooltip content="Reload">
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
				<div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
					{/* Search Box */}
					<div className="relative flex-1 sm:w-64">
						<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
							<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
						</div>
						<input
							type="text"
							value={searchInput}
							onChange={(e) => setSearchInput(e.target.value)}
							placeholder="Search instances..."
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
				</div>
			</div>

			{/* Error Message */}
			{error && <Alert variant="error">{error instanceof Error ? error.message : "An error occurred"}</Alert>}

			{/* Instances Table */}
			<div className="bg-gray-100 dark:bg-neutral-800 shadow-md rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700">
				<InstancesTable
					data={filteredInstances}
					loading={isLoading}
				/>
			</div>

			{/* Route-based Instance Detail Modal */}
			<Outlet context={{ instances: instancesResponse?.data || [] }} />
		</div>
	);
};

export default Instances;
