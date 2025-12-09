import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import { LoadingSpinner, Page, ErrorAlert, Button, Tooltip, ConfirmModal } from "@/components";
import StatsCards from "./StatsCards/StatsCards";
import OutputsChart from "./OutputsChart/OutputsChart";
import { TrashIcon } from "@heroicons/react/24/outline";

type StatRow = {
	key: string;
	date: string;
	data: {
		jobs_recieved_count?: number;
		jobs_retried_count?: number;
		jobs_failed_count?: number;
		jobs_completed_count?: number;

		inputs_recieved_count?: number;
		inputs_failed_count?: number;
		inputs_failed_duration?: number;
		inputs_completed_count?: number;
		inputs_completed_duration?: number;

		outputs_requested_count?: number;
		outputs_failed_count?: number;
		outputs_failed_duration?: number;
		outputs_completed_count?: number;
		outputs_completed_duration?: number;

		notifications_created_count?: number;
		notifications_sent_count?: number;
		notifications_retried_count?: number;
		notifications_failed_count?: number;
		[key: string]: number | undefined;
	};
};

type DateRange = "7d" | "30d" | "90d" | "180d" | "1y";

const DATE_RANGE_OPTIONS: { label: string; value: DateRange; days: number }[] = [
	{ label: "Last 7 days", value: "7d", days: 7 },
	{ label: "Last 1 month", value: "30d", days: 30 },
	{ label: "Last 3 months", value: "90d", days: 90 },
	{ label: "Last 6 months", value: "180d", days: 180 },
	{ label: "Last 1 year", value: "1y", days: 365 }
];

const Overview: React.FC = () => {
	const { authToken } = useAuth();
	const queryClient = useQueryClient();
	const [dateRange, setDateRange] = useState<DateRange>("30d");
	const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

	const option = DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)!;
	const until = new Date();
	const since = new Date();
	since.setDate(until.getDate() - (option.days - 1));
	const format = (d: Date) => d.toISOString().slice(0, 10);

	const {
		data: statsResponse,
		isLoading,
		error,
		refetch
	} = useQuery<ApiResponse<StatRow[]>>({
		queryKey: ["stats", dateRange, authToken],
		queryFn: () =>
			api.get<StatRow[]>("/stats", {
				token: authToken || "",
				since_at: format(since),
				until_at: format(until)
			}),
		enabled: !!authToken,
		refetchOnWindowFocus: true,
		refetchInterval: 15_000 // 15 saniyede bir otomatik refresh
	});

	const deleteAllStatsMutation = useMutation({
		mutationFn: async () => {
			return await api.delete("/stats", { token: authToken, all: "true" });
		},
		onSuccess: async () => {
			setShowDeleteAllModal(false);
			await queryClient.invalidateQueries({ queryKey: ["stats"] });
			await refetch();
		}
	});

	const stats = statsResponse?.data || [];

	const aggregates = useMemo(() => {
		return stats.reduce(
			(acc, row) => {
				acc.jobs_recieved_count += row.data.jobs_recieved_count || 0;
				acc.jobs_retried_count += row.data.jobs_retried_count || 0;
				acc.jobs_failed_count += row.data.jobs_failed_count || 0;
				acc.jobs_completed_count += row.data.jobs_completed_count || 0;

				acc.inputs_recieved_count += row.data.inputs_recieved_count || 0;
				acc.inputs_failed_count += row.data.inputs_failed_count || 0;
				acc.inputs_failed_duration += row.data.inputs_failed_duration || 0;
				acc.inputs_completed_count += row.data.inputs_completed_count || 0;
				acc.inputs_completed_duration += row.data.inputs_completed_duration || 0;

				acc.outputs_requested_count += row.data.outputs_requested_count || 0;
				acc.outputs_failed_count += row.data.outputs_failed_count || 0;
				acc.outputs_failed_duration += row.data.outputs_failed_duration || 0;
				acc.outputs_completed_count += row.data.outputs_completed_count || 0;
				acc.outputs_completed_duration += row.data.outputs_completed_duration || 0;

				acc.notifications_created_count += row.data.notifications_created_count || 0;
				acc.notifications_sent_count += row.data.notifications_sent_count || 0;
				acc.notifications_retried_count += row.data.notifications_retried_count || 0;
				acc.notifications_failed_count += row.data.notifications_failed_count || 0;

				return acc;
			},
			{
				jobs_recieved_count: 0,
				jobs_retried_count: 0,
				jobs_failed_count: 0,
				jobs_completed_count: 0,

				inputs_recieved_count: 0,
				inputs_failed_count: 0,
				inputs_failed_duration: 0,
				inputs_completed_count: 0,
				inputs_completed_duration: 0,

				outputs_requested_count: 0,
				outputs_failed_count: 0,
				outputs_failed_duration: 0,
				outputs_completed_count: 0,
				outputs_completed_duration: 0,

				notifications_created_count: 0,
				notifications_sent_count: 0,
				notifications_retried_count: 0,
				notifications_failed_count: 0
			}
		);
	}, [stats.length, stats]);

	const handleRefresh = () => {
		queryClient.invalidateQueries({ queryKey: ["stats"] });
	};

	const handleDeleteAllStats = () => {
		setShowDeleteAllModal(true);
	};

	const handleConfirmDeleteAll = () => {
		deleteAllStatsMutation.mutate();
	};

	const handleCloseDeleteAllModal = () => {
		if (!deleteAllStatsMutation.isPending) {
			setShowDeleteAllModal(false);
		}
	};

	return (
		<Page>
			{/* Page Header */}
			<Page.Header
				title="Overview"
				onRefresh={handleRefresh}
				isRefreshing={isLoading}>
				<div className="flex items-center gap-2">
					<label
						htmlFor="date-range"
						className="text-sm font-medium text-gray-700 dark:text-gray-300">
						Date range
					</label>
					<select
						id="date-range"
						value={dateRange}
						onChange={(e) => setDateRange(e.target.value as DateRange)}
						className="rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500">
						{DATE_RANGE_OPTIONS.map((option) => (
							<option
								key={option.value}
								value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</div>
				<Tooltip content="Delete All Stats">
					<Button
						variant="soft"
						hover="danger"
						size="md"
						iconOnly
						onClick={handleDeleteAllStats}
						disabled={deleteAllStatsMutation.isPending || stats.length === 0}
						isLoading={deleteAllStatsMutation.isPending}>
						<TrashIcon className="h-5 w-5" />
					</Button>
				</Tooltip>
			</Page.Header>

			{/* Loading State */}
			{isLoading && !statsResponse && <LoadingSpinner />}

			{/* Error Alert */}
			<ErrorAlert error={error} />

			{/* Content */}
			{!isLoading && !error && (
				<>
					{/* Top stat cards */}
					<StatsCards aggregates={aggregates} />

					{/* Outputs chart */}
					<OutputsChart
						stats={stats}
						aggregates={aggregates}
					/>
				</>
			)}

			{/* Delete All Confirmation Modal */}
			{showDeleteAllModal && (
				<ConfirmModal
					isOpen={showDeleteAllModal}
					onClose={handleCloseDeleteAllModal}
					onConfirm={handleConfirmDeleteAll}
					title="Delete All Stats"
					message={
						<>
							<p className="mb-4">
								Are you sure you want to delete <strong>all stats</strong> for <strong>{option.label.toLowerCase()}</strong>
								?
							</p>
							<p className="font-semibold text-red-600 dark:text-red-400">This action cannot be undone!</p>
						</>
					}
					confirmText="Delete All"
					variant="danger"
					isLoading={deleteAllStatsMutation.isPending}
					loadingText="Deleting"
				/>
			)}
		</Page>
	);
};

export default Overview;
