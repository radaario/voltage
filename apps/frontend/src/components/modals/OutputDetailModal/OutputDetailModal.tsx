import { useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	ArrowUpTrayIcon,
	InformationCircleIcon,
	DocumentChartBarIcon,
	ClipboardDocumentCheckIcon,
	ArrowPathIcon,
	XMarkIcon,
	DocumentTextIcon
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { useRouteModal } from "@/hooks/useRouteModal";
import { api, ApiResponse } from "@/utils";
import { Modal, ConfirmModal, Label, Button, Tooltip, TabsNavigation, LoadingSpinner } from "@/components";
import type { JobOutput } from "@/interfaces/job";

const OutputDetailModal: React.FC = () => {
	const { jobKey, outputKey } = useParams<{ jobKey: string; outputKey: string }>();
	const { authToken } = useAuth();
	const queryClient = useQueryClient();
	const modalProps = useRouteModal({ navigateBackTo: `/jobs/${jobKey}/outputs`, id: "OutputDetailModal" });
	const [showRetryModal, setShowRetryModal] = useState(false);

	// Fetch output details
	const { data: outputResponse, isLoading } = useQuery<ApiResponse<JobOutput>>({
		queryKey: ["output", outputKey],
		queryFn: () =>
			api.get<JobOutput>("/jobs/outputs", {
				token: authToken || "",
				output_key: outputKey || ""
			}),
		enabled: !!outputKey && !!authToken
	});

	const output = outputResponse?.data;

	// Retry output mutation
	const retryOutputMutation = useMutation({
		mutationFn: async () => {
			return await api.post("/jobs/outputs/retry", null, {
				params: { token: authToken, output_key: outputKey, job_key: jobKey }
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["output", outputKey] });
			queryClient.invalidateQueries({ queryKey: ["outputs", jobKey] });
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
		{ path: "outcome", label: "Outcome", icon: ClipboardDocumentCheckIcon },
		{ path: "logs", label: "Logs", icon: DocumentTextIcon }
	];

	return (
		<>
			<Modal
				{...modalProps}
				height="xl"
				size="5xl">
				{/* Header */}
				<Modal.Header
					onClose={modalProps.handleClose}
					showCloseButton={false}>
					<div className="flex items-start justify-between w-full">
						<div className="flex items-start gap-3 overflow-hidden min-w-0">
							<ArrowUpTrayIcon className="h-7 w-7 text-gray-600 dark:text-gray-400 mt-0.5 shrink-0" />
							<div className="min-w-0">
								{output && (
									<div className="flex flex-col min-w-0">
										<h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
											{output.specs?.name
												? output.specs?.name + " - " + output.specs.format
												: `Output #${output.index + 1}`}
										</h3>
										<p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">{output.key}</p>
									</div>
								)}
								{!output && <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Loading...</h3>}
							</div>
						</div>
						<div className="flex items-center gap-3 shrink-0 ml-4">
							{["QUEUED", "COMPLETED", "CANCELLED", "DELETED", "FAILED", "TIMEOUT"].includes(output?.status as string) && (
								<Button
									variant="secondary"
									size="xs"
									onClick={handleRetry}>
									<ArrowPathIcon className="w-4 h-4" />
									Retry
								</Button>
							)}
							{output && <Label status={output.status}>{output.status}</Label>}
							<Tooltip content="Close">
								<Button
									variant="ghost"
									size="md"
									iconOnly
									onClick={modalProps.handleClose}>
									<XMarkIcon className="h-6 w-6" />
								</Button>
							</Tooltip>
						</div>
					</div>
				</Modal.Header>

				{/* Tabs Navigation */}
				<TabsNavigation tabs={tabs} />

				{/* Tab Content */}
				<Modal.Content
					noPadding
					className="h-[50vh]">
					<div className="p-6 h-full overflow-y-auto">{isLoading ? <LoadingSpinner /> : <Outlet context={{ output }} />}</div>
				</Modal.Content>
			</Modal>

			{output && (
				<ConfirmModal
					isOpen={showRetryModal}
					onClose={handleCloseRetryModal}
					onConfirm={handleConfirmRetry}
					title="Retry"
					message={
						<>
							<p className="mb-4">Are you sure you want to retry this output?</p>
							<ul className="list-disc list-inside space-y-1 mb-4 text-sm">
								<li>{output.key}</li>
							</ul>
						</>
					}
					confirmText="Retry"
					variant="info"
					isLoading={retryOutputMutation.isPending}
				/>
			)}
		</>
	);
};

export default OutputDetailModal;
