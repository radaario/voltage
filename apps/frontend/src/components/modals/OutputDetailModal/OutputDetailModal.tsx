import { useState, useMemo } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { InformationCircleIcon, DocumentChartBarIcon, ClipboardDocumentCheckIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { useRouteModal } from "@/hooks/useRouteModal";
import { api, ApiResponse } from "@/utils";
import { Modal, Label, Button, ConfirmModal } from "@/components";
import type { Job } from "@/interfaces/job";

const OutputDetailModal: React.FC = () => {
	const { jobKey, outputKey } = useParams<{ jobKey: string; outputKey: string }>();
	const { authToken } = useAuth();
	const queryClient = useQueryClient();
	const modalProps = useRouteModal({ navigateBackTo: `/jobs/${jobKey}/outputs`, id: "OutputDetailModal" });
	const [showRetryModal, setShowRetryModal] = useState(false);

	// Fetch job details to get outputs
	const { data: jobResponse, isLoading } = useQuery<ApiResponse<Job>>({
		queryKey: ["job", jobKey],
		queryFn: () =>
			api.get<Job>("/jobs", {
				token: authToken || "",
				job_key: jobKey || ""
			}),
		enabled: !!jobKey && !!authToken
	});

	const job = jobResponse?.data;

	// Find the output from job's outputs array
	const output = useMemo(() => {
		if (!job?.outputs || !outputKey) return null;
		return job.outputs.find((o) => o.key === outputKey);
	}, [job?.outputs, outputKey]);

	// Retry output mutation
	const retryOutputMutation = useMutation({
		mutationFn: async () => {
			return await api.post("/jobs/retry", null, {
				params: { token: authToken, output_key: outputKey }
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["job", jobKey] });
			setShowRetryModal(false);
		}
	});

	const handleRetry = () => {
		if (!outputKey) return;
		setShowRetryModal(true);
	};

	const handleConfirmRetry = () => {
		retryOutputMutation.mutate();
	};

	const handleCloseRetryModal = () => {
		if (!retryOutputMutation.isPending) {
			setShowRetryModal(false);
		}
	};

	if (!output && !isLoading) {
		return null;
	}

	const tabs = [
		{ path: "info", label: "Info", icon: InformationCircleIcon },
		{ path: "specs", label: "Specs", icon: DocumentChartBarIcon },
		{ path: "outcome", label: "Outcome", icon: ClipboardDocumentCheckIcon }
	];

	return (
		<>
			<Modal
				{...modalProps}
				height="lg"
				size="3xl">
				{/* Header */}
				<Modal.Header
					onClose={modalProps.handleClose}
					showCloseButton={false}>
					<div className="flex items-start justify-between w-full">
						<div className="flex flex-col min-w-0 mr-3">
							{output ? (
								<div className="flex flex-col min-w-0">
									<h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">Output #{output.index + 1}</h3>
									<p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">{output.key}</p>
								</div>
							) : (
								<div className="flex flex-col gap-2">
									<div className="h-6 bg-gray-200 dark:bg-neutral-700 rounded w-32 animate-pulse" />
									<div className="h-4 bg-gray-200 dark:bg-neutral-700 rounded w-48 animate-pulse" />
								</div>
							)}
						</div>
						<div className="shrink-0 flex items-center gap-3 ml-4">
							{output?.status === "FAILED" && (
								<Button
									variant="secondary"
									size="xs"
									onClick={handleRetry}>
									<ArrowUturnLeftIcon className="w-4 h-4" />
									Retry
								</Button>
							)}
							{output && <Label status={output.status}>{output.status}</Label>}
							<Button
								variant="ghost"
								size="md"
								iconOnly
								onClick={modalProps.handleClose}>
								<svg
									className="h-6 w-6"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</Button>
						</div>
					</div>
				</Modal.Header>

				{/* Tabs Navigation */}
				<div className="shrink-0 flex gap-6 px-6 border-b border-gray-200 dark:border-neutral-700 overflow-x-auto">
					{tabs.map((tab) => (
						<NavLink
							key={tab.path}
							to={tab.path}
							className={({ isActive }) =>
								`flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
									isActive
										? "border-neutral-900 dark:border-white text-neutral-900 dark:text-white"
										: "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
								}`
							}>
							<tab.icon className="w-5 h-5" />
							{tab.label}
						</NavLink>
					))}
				</div>

				{/* Tab Content */}
				<Modal.Content
					noPadding
					className="h-[50vh]">
					<div className="p-6 h-full overflow-y-auto">
						{isLoading ? (
							<div className="flex items-center justify-center h-full">
								<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900 dark:border-white" />
							</div>
						) : (
							<Outlet context={{ output }} />
						)}
					</div>
				</Modal.Content>
			</Modal>

			<ConfirmModal
				isOpen={showRetryModal}
				onClose={handleCloseRetryModal}
				onConfirm={handleConfirmRetry}
				title="Retry Output"
				message={`Are you sure you want to retry this output?`}
				confirmText="Retry"
				variant="info"
				isLoading={retryOutputMutation.isPending}
			/>
		</>
	);
};

export default OutputDetailModal;
