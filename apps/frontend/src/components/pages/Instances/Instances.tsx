import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Outlet } from "react-router-dom";
import type { Instance } from "@/interfaces/instance";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import InstancesTable from "@/components/pages/Instances/Table/Table";
import { SearchInput, LoadingSpinner, Page, ErrorAlert, Button, Tooltip, ConfirmModal } from "@/components";
import { TrashIcon } from "@heroicons/react/24/outline";

const Instances: React.FC = () => {
	const { authToken } = useAuth();
	const queryClient = useQueryClient();

	// states
	const [searchQuery, setSearchQuery] = useState("");
	const [searchInput, setSearchInput] = useState("");
	const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

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

	// mutations
	const deleteAllInstancesMutation = useMutation({
		mutationFn: async () => {
			return await api.delete("/instances", { token: authToken, all: "true" });
		},
		onSuccess: async () => {
			setShowDeleteAllModal(false);
			await queryClient.invalidateQueries({ queryKey: ["instances"] });
			await refetch();
		}
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

	const handleDeleteAllInstances = () => {
		setShowDeleteAllModal(true);
	};

	const handleConfirmDeleteAll = () => {
		deleteAllInstancesMutation.mutate();
	};

	const handleCloseDeleteAllModal = () => {
		if (!deleteAllInstancesMutation.isPending) {
			setShowDeleteAllModal(false);
		}
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
				<Tooltip content="Delete All">
					<Button
						variant="soft"
						hover="danger"
						size="md"
						iconOnly
						onClick={handleDeleteAllInstances}
						disabled={deleteAllInstancesMutation.isPending || (instancesResponse?.data?.length || 0) === 0}
						isLoading={deleteAllInstancesMutation.isPending}>
						<TrashIcon className="h-5 w-5 " />
					</Button>
				</Tooltip>
			</Page.Header>

			{/* Error Alert */}
			<ErrorAlert error={error} />

			{/* Instances Table */}
			<InstancesTable
				data={filteredInstances}
				loading={isLoading}
			/>

			{/* Delete All Confirmation Modal */}
			{showDeleteAllModal && (
				<ConfirmModal
					isOpen={showDeleteAllModal}
					onClose={handleCloseDeleteAllModal}
					onConfirm={handleConfirmDeleteAll}
					title="Delete All Instances"
					message={
						<>
							<p className="mb-4">
								Are you sure you want to delete <strong className="text-red-600 dark:text-red-400">all instances</strong>?
							</p>
							<p className="font-semibold text-red-600 dark:text-red-400">This action cannot be undone!</p>
						</>
					}
					confirmText="Delete All"
					variant="danger"
					isLoading={deleteAllInstancesMutation.isPending}
					loadingText="Deleting"
				/>
			)}

			{/* Route-based Instance Detail Modal */}
			<Outlet context={{ instances: instancesResponse?.data || [] }} />
		</Page>
	);
};

export default Instances;
