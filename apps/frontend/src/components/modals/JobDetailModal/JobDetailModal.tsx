import { useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	InformationCircleIcon,
	ArrowDownTrayIcon,
	ArrowUpTrayIcon,
	DocumentTextIcon,
	BellIcon,
	ClipboardDocumentCheckIcon,
	ArrowUturnLeftIcon,
	XMarkIcon
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { useRouteModal } from "@/hooks/useRouteModal";
import { api, ApiResponse } from "@/utils";
import { Modal, Label, Button, Tooltip, ConfirmModal, TabsNavigation } from "@/components";
import type { Job } from "@/interfaces/job";
import { JobPreviewImage } from "@/components";

const JobDetailModal: React.FC = () => {
	const { jobKey } = useParams<{ jobKey: string }>();
	const { authToken } = useAuth();
	const queryClient = useQueryClient();
	const modalProps = useRouteModal({ navigateBackTo: "/jobs", id: "JobDetailModal" });

	// states
	const [showRetryModal, setShowRetryModal] = useState(false);

	// queries
	const { data: jobResponse, isLoading } = useQuery<ApiResponse<Job>>({
		queryKey: ["job", jobKey],
		queryFn: () =>
			api.get<Job>("/jobs", {
				token: authToken || "",
				job_key: jobKey || ""
			}),
		enabled: !!jobKey && !!authToken
	});

	// mutations
	const retryJobMutation = useMutation({
		mutationFn: async () => {
			return await api.post("/jobs/retry", null, {
				params: { token: authToken, job_key: jobKey }
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["jobs"] });
			queryClient.invalidateQueries({ queryKey: ["job", jobKey] });
			setShowRetryModal(false);
		}
	});

	// data
	const job = jobResponse?.data;
	const filename = job?.input?.file_name || job?.input?.url?.split("/").pop() || "Unknown";
	const specs: string[] = [];

	// Resolution
	const width = job?.input?.video_width;
	const height = job?.input?.video_height;
	if (width && height) {
		specs.push(`${width}x${height}px`);
	}

	// Size
	const size = job?.input?.file_size;
	if (size) {
		const sizeInMB = (size / (1024 * 1024)).toFixed(1);
		specs.push(`${sizeInMB}mb`);
	}

	const tabs = [
		{ path: "info", label: "Info", icon: InformationCircleIcon },
		{ path: "input", label: "Input", icon: ArrowDownTrayIcon },
		{ path: "outputs", label: "Outputs", icon: ArrowUpTrayIcon },
		{ path: "outcome", label: "Outcome", icon: ClipboardDocumentCheckIcon },
		{ path: "notifications", label: "Notifications", icon: BellIcon },
		{ path: "logs", label: "Logs", icon: DocumentTextIcon }
	];

	// actions
	const handleRetry = () => {
		if (!jobKey) return;
		setShowRetryModal(true);
	};

	const handleConfirmRetry = () => {
		retryJobMutation.mutate();
	};

	const handleCloseRetryModal = () => {
		if (!retryJobMutation.isPending) {
			setShowRetryModal(false);
		}
	};

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
						<div className="flex items-center gap-4 mr-3 overflow-hidden min-w-0">
							{/* Preview Image */}
							{job && (
								<JobPreviewImage
									className="w-24 h-16 relative shrink-0 bg-gray-100 dark:bg-neutral-700 rounded overflow-hidden"
									jobKey={job.key}
									authToken={authToken}
									duration={job?.input?.duration}
									version={job.updated_at}
								/>
							)}
							<div className="flex flex-col min-w-0">
								{job ? (
									<div className="flex flex-col min-w-0">
										<h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">{filename}</h3>
										<p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">{job?.key}</p>
										{specs.length > 0 && (
											<span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{specs.join(", ")}</span>
										)}
									</div>
								) : (
									<h3 className="text-xl font-bold text-gray-900 dark:text-white">Loading...</h3>
								)}
							</div>
						</div>
						<div className="flex items-center gap-3 shrink-0 ml-4">
							{["CANCELLED", "DELETED", "FAILED", "TIMEOUT"].includes(job?.status as string) && (
								<Button
									variant="secondary"
									size="xs"
									onClick={handleRetry}>
									<ArrowUturnLeftIcon className="w-3 h-3" />
									Retry
								</Button>
							)}
							{/* Status Badge */}
							{job && (
								<Label
									status={job.status}
									hidden="sm">
									{job.status}
								</Label>
							)}
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
					className="h-[65vh]">
					<div className="p-6 h-full overflow-y-auto">
						{isLoading ? (
							<div className="flex justify-center items-center py-12">
								<div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-500 dark:border-gray-400 border-t-transparent"></div>
							</div>
						) : (
							<Outlet context={{ job: job }} />
						)}
					</div>
				</Modal.Content>
			</Modal>

			<ConfirmModal
				isOpen={showRetryModal}
				onClose={handleCloseRetryModal}
				onConfirm={handleConfirmRetry}
				title="Retry Job"
				message={`Are you sure you want to retry this job?`}
				confirmText="Retry"
				variant="info"
				isLoading={retryJobMutation.isPending}
			/>
		</>
	);
};

export default JobDetailModal;
