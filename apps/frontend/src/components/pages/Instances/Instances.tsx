import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Outlet } from "react-router-dom";
import type { Instance } from "@/interfaces/instance";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import InstancesTable from "./InstancesTable";
import { SearchInput, LoadingSpinner, PageHeader, ErrorAlert } from "@/components";

const Instances: React.FC = () => {
	const { authToken } = useAuth();

	// states
	const [searchQuery, setSearchQuery] = useState("");
	const [searchInput, setSearchInput] = useState("");

	// queries
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

	// data
	const filteredInstances = instancesResponse?.data || [];

	// actions
	const handleClearSearch = () => {
		setSearchInput("");
	};

	const handleRefresh = () => {
		refetch();
	};

	// effects
	useEffect(() => {
		const timer = setTimeout(() => {
			setSearchQuery(searchInput);
		}, 500);

		return () => clearTimeout(timer);
	}, [searchInput]);

	// renders
	if (isLoading && !instancesResponse) {
		return <LoadingSpinner />;
	}

	return (
		<div className="space-y-6">
			<PageHeader
				title="Instances"
				onRefresh={handleRefresh}
				isRefreshing={isLoading}>
				<SearchInput
					value={searchInput}
					onChange={setSearchInput}
					onClear={handleClearSearch}
					placeholder="Search instances..."
				/>
			</PageHeader>

			<ErrorAlert error={error} />

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
