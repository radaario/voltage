import { useState } from "react";
import { useParams, NavLink, Outlet } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	InformationCircleIcon,
	DocumentTextIcon,
	ClipboardDocumentCheckIcon,
	Cog6ToothIcon,
	ArrowUturnLeftIcon
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import { useRouteModal } from "@/hooks/useRouteModal";
import { Modal, Label, Button, ConfirmModal } from "@/components";
import type { Notification } from "@/interfaces/notification";

const NotificationDetailModal: React.FC = () => {
	const { notificationKey, jobKey } = useParams<{ notificationKey: string; jobKey?: string }>();
	const { authToken } = useAuth();
	const queryClient = useQueryClient();
	const [showRetryModal, setShowRetryModal] = useState(false);

	// Determine navigate back path based on current route
	// If we're in /jobs/{jobKey}/notifications/{notificationKey}, go back to notifications tab
	// If we're in /notifications/{notificationKey}, go back to notifications page
	const navigateBackTo = jobKey ? `/jobs/${jobKey}/notifications` : "/notifications";

	const modalProps = useRouteModal({ navigateBackTo, id: "NotificationDetailModal" });

	// Fetch notification details
	const { data: notificationResponse, isLoading } = useQuery<ApiResponse<Notification>>({
		queryKey: ["notification", notificationKey],
		queryFn: () =>
			api.get<Notification>("/jobs/notifications", {
				token: authToken || "",
				notification_key: notificationKey || ""
			}),
		enabled: !!notificationKey && !!authToken
	});

	const notification = notificationResponse?.data;

	// Retry notification mutation
	const retryNotificationMutation = useMutation({
		mutationFn: async () => {
			return await api.post("/jobs/notifications/retry", null, {
				params: { token: authToken, notification_key: notification?.key }
			});
		},
		onSuccess: () => {
			// Invalidate list queries and detail query
			queryClient.invalidateQueries({ queryKey: ["notifications"] });
			queryClient.invalidateQueries({ queryKey: ["notification", notificationKey] });
			setShowRetryModal(false);
		}
	});

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

	const tabs = [
		{ path: "info", label: "Info", icon: InformationCircleIcon },
		{ path: "specs", label: "Specs", icon: Cog6ToothIcon },
		{ path: "payload", label: "Payload", icon: DocumentTextIcon },
		{ path: "outcome", label: "Outcome", icon: ClipboardDocumentCheckIcon }
	];

	return (
		<>
			<Modal
				{...modalProps}
				height={modalProps.isTopModal ? "xl" : "lg"}
				size="4xl">
				{/* Header with Title and Actions */}
				<Modal.Header
					onClose={modalProps.handleClose}
					showCloseButton={false}>
					<div className="flex items-start justify-between w-full">
						<div className="flex items-start gap-3 overflow-hidden min-w-0">
							<InformationCircleIcon className="h-7 w-7 text-gray-600 dark:text-gray-400 mt-0.5 shrink-0" />
							<div className="min-w-0">
								{notification && (
									<>
										<h3 className="text-2xl font-bold text-gray-900 dark:text-white">
											{notification.status || "Notification"}
										</h3>
										<p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono truncate">
											{notification.key}
										</p>
									</>
								)}
								{!notification && <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Loading...</h3>}
							</div>
						</div>
						<div className="flex items-center gap-3 shrink-0 ml-4">
							{["FAILED"].includes(notification?.status as string) && (
								<Button
									variant="secondary"
									size="xs"
									onClick={handleRetry}>
									<ArrowUturnLeftIcon className="w-4 h-4" />
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
				<div className="shrink-0 border-b border-gray-200 dark:border-neutral-700">
					<nav className="flex px-6 gap-8 overflow-x-auto">
						{tabs.map((tab) => (
							<NavLink
								key={tab.path}
								to={tab.path}
								className={({ isActive }) =>
									`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
										isActive
											? "border-neutral-700 text-gray-900 dark:border-neutral-400 dark:text-white"
											: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
									}`
								}>
								<tab.icon className="h-4 w-4" />
								{tab.label}
							</NavLink>
						))}
					</nav>
				</div>

				{/* Tab Content */}
				<Modal.Content
					noPadding
					className="h-[60vh]">
					<div className="p-6 h-full overflow-y-auto">
						{isLoading ? (
							<div className="flex justify-center items-center py-12">
								<div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-500 dark:border-gray-400 border-t-transparent"></div>
							</div>
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
							Are you sure you want to retry notification <strong>{notification.status}</strong>?
							<div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">({notification.key})</div>
						</>
					}
					confirmText="Retry Notification"
					variant="info"
					isLoading={retryNotificationMutation.isPending}
					loadingText="Retrying"
				/>
			)}
		</>
	);
};

export default NotificationDetailModal;
