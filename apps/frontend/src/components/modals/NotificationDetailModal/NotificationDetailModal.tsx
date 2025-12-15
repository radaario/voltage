import { useState } from "react";
import { useParams, Outlet } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	BellIcon,
	InformationCircleIcon,
	DocumentTextIcon,
	ClipboardDocumentCheckIcon,
	DocumentChartBarIcon,
	ArrowPathIcon,
	XMarkIcon
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import { useRouteModal } from "@/hooks/useRouteModal";
import { Modal, ConfirmModal, Label, Button, Tooltip, TabsNavigation, LoadingSpinner } from "@/components";
import type { Notification } from "@/interfaces/notification";

const NotificationDetailModal: React.FC = () => {
	const { notificationKey, jobKey } = useParams<{ notificationKey: string; jobKey?: string }>();
	const { authToken } = useAuth();
	const queryClient = useQueryClient();

	// states
	const [showRetryModal, setShowRetryModal] = useState(false);

	// Determine navigate back path based on current route
	// If we're in /jobs/{jobKey}/notifications/{notificationKey}, go back to notifications tab
	// If we're in /notifications/{notificationKey}, go back to notifications page
	const navigateBackTo = jobKey ? `/jobs/${jobKey}/notifications` : "/notifications";

	const modalProps = useRouteModal({ navigateBackTo, id: "NotificationDetailModal" });

	// queries
	const { data: notificationResponse, isLoading } = useQuery<ApiResponse<Notification>>({
		queryKey: ["notification", notificationKey],
		queryFn: () =>
			api.get<Notification>("/jobs/notifications", {
				token: authToken || "",
				notification_key: notificationKey || ""
			}),
		enabled: !!notificationKey && !!authToken
	});

	// mutations
	const retryNotificationMutation = useMutation({
		mutationFn: async () => {
			return await api.post("/jobs/notifications/retry", null, {
				params: { token: authToken, notification_key: notification?.key }
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["notifications"] });
			queryClient.invalidateQueries({ queryKey: ["notification", notificationKey] });
			setShowRetryModal(false);
		}
	});

	// data
	const notification = notificationResponse?.data;

	const tabs = [
		{ path: "info", label: "Info", icon: InformationCircleIcon },
		{ path: "specs", label: "Specs", icon: DocumentChartBarIcon },
		{ path: "payload", label: "Payload", icon: DocumentTextIcon },
		{ path: "outcome", label: "Outcome", icon: ClipboardDocumentCheckIcon }
	];

	// actions
	const handleRetry = () => {
		if (!notificationKey) return;
		setShowRetryModal(true);
	};

	const handleConfirmRetry = () => {
		retryNotificationMutation.mutate();
	};

	const handleCloseRetryModal = () => {
		if (!retryNotificationMutation.isPending) {
			setShowRetryModal(false);
		}
	};

	return (
		<>
			<Modal
				{...modalProps}
				height="xl"
				size="5xl">
				{/* Header with Title and Actions */}
				<Modal.Header
					onClose={modalProps.handleClose}
					showCloseButton={false}>
					<div className="flex items-start justify-between w-full">
						<div className="flex items-start gap-3 overflow-hidden min-w-0">
							<BellIcon className="h-7 w-7 text-gray-600 dark:text-gray-400 mt-0.5 shrink-0" />
							<div className="min-w-0">
								{notification && (
									<>
										<div className="flex items-center gap-3">
											<h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Notification</h3>
											<Label
												status={notification.payload?.status as string | undefined}
												statusColor={false}>
												{(notification.payload?.status as string | undefined) || "UNKNOWN"}
											</Label>
										</div>
										<p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono truncate">
											{notification.key}
										</p>
									</>
								)}
								{!notification && (
									<h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Loading...</h3>
								)}
							</div>
						</div>
						<div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 ml-4">
							{["FAILED"].includes(notification?.status as string) && (
								<Button
									variant="secondary"
									size="xs"
									className="order-3 sm:order-1"
									onClick={handleRetry}>
									<ArrowPathIcon className="w-4 h-4" />
									Retry
								</Button>
							)}

							{/* Status Badge */}
							{notification && (
								<Label
									status={notification.status || "PENDING"}
									hidden="sm">
									{notification.status || "PENDING"}
								</Label>
							)}

							<Tooltip content="Close">
								<Button
									variant="ghost"
									size="md"
									iconOnly
									className="order-1 sm:order-3"
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
					className="h-[60vh]">
					<div className="p-6 h-full overflow-y-auto">
						{isLoading ? (
							<LoadingSpinner />
						) : !notification ? (
							<div className="flex flex-col justify-center items-center py-12 gap-3">
								<p className="text-sm text-gray-600 dark:text-gray-400">Notification not found.</p>
								<Button
									variant="secondary"
									size="sm"
									onClick={modalProps.handleClose}>
									Close
								</Button>
							</div>
						) : (
							<Outlet context={{ notification: notification }} />
						)}
					</div>
				</Modal.Content>
			</Modal>

			{/* Retry Confirmation Modal */}
			{showRetryModal && notification && (
				<ConfirmModal
					isOpen={showRetryModal}
					onClose={handleCloseRetryModal}
					onConfirm={handleConfirmRetry}
					title="Retry Notification"
					message={
						<>
							<p className="mb-4">Are you sure you want to retry this notification?</p>
							<ul className="list-disc list-inside space-y-1 mb-4 text-sm">
								<li>{notification.key}</li>
							</ul>
						</>
					}
					confirmText="Retry"
					variant="info"
					isLoading={retryNotificationMutation.isPending}
					loadingText="Retrying"
				/>
			)}
		</>
	);
};

export default NotificationDetailModal;
