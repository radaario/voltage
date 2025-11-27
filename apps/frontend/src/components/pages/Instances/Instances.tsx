import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Outlet } from "react-router-dom";
import type { Instance } from "@/interfaces/instance";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import InstancesTable from "@/components/pages/Instances/Table/Table";
import { SearchInput, LoadingSpinner, Page, ErrorAlert } from "@/components";

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
		<Page>
			{/* Page Header */}
			<Page.Header
				title="Instances"
				onRefresh={handleRefresh}
				isRefreshing={isLoading}>
				<SearchInput
					value={searchInput}
					onChange={setSearchInput}
					onClear={handleClearSearch}
					placeholder="Search instances..."
				/>
			</Page.Header>

			{/* Error Alert */}
			<ErrorAlert error={error} />

			{/* Instances Table */}
			<InstancesTable
				data={filteredInstances}
				loading={isLoading}
			/>

			{/* Route-based Instance Detail Modal */}
			<Outlet context={{ instances: instancesResponse?.data || [] }} />
		</Page>
	);
};

export default Instances;
