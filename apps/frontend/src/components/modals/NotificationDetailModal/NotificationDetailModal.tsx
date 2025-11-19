import { useEffect, useState } from "react";
import { useNavigate, useParams, NavLink, Outlet } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { XMarkIcon, InformationCircleIcon, DocumentTextIcon, ClipboardDocumentCheckIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import Label from "@/components/base/Label/Label";
import Button from "@/components/base/Button/Button";
import { ConfirmModal } from "@/components";
import type { Notification } from "@/interfaces/notification";

const NotificationDetailModal: React.FC = () => {
	const { notificationKey } = useParams<{ notificationKey: string }>();
	const navigate = useNavigate();
	const { authToken } = useAuth();
	const [isAnimating, setIsAnimating] = useState(false);
	const queryClient = useQueryClient();
	const [showRetryModal, setShowRetryModal] = useState(false);

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

	useEffect(() => {
		const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
		document.body.style.overflow = "hidden";
		document.body.style.paddingRight = `${scrollbarWidth}px`;
		setTimeout(() => setIsAnimating(true), 10);

		return () => {
			document.body.style.overflow = "unset";
			document.body.style.paddingRight = "";
		};
	}, []);

	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				handleClose();
			}
		};

		window.addEventListener("keydown", handleEscape);
		return () => window.removeEventListener("keydown", handleEscape);
	}, []);

	const handleClose = () => {
		setIsAnimating(false);
		setTimeout(() => {
			navigate("/notifications");
		}, 300);
	};

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

	const ModalContent = (
		<div className="fixed inset-0 z-60 overflow-y-auto">
			{/* Backdrop */}
			<div
				className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
					isAnimating ? "opacity-100" : "opacity-0"
				}`}
				onClick={handleClose}
			/>

			{/* Modal Container */}
			<div className="flex min-h-full items-center justify-center p-4">
				{/* Modal Panel */}
				<div
					className={`relative overflow-hidden w-full max-w-4xl h-[80vh] flex flex-col bg-white dark:bg-neutral-800 rounded-2xl shadow-xl z-10 transition-all duration-300 ${
						isAnimating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
					}`}
					onClick={(e) => e.stopPropagation()}>
					{/* Header */}
					<div className="shrink-0 flex items-start justify-between p-6 border-b border-gray-200 dark:border-neutral-700">
						<div className="flex items-start gap-3">
							<InformationCircleIcon className="h-7 w-7 text-gray-600 dark:text-gray-400 mt-0.5" />
							<div>
								{notification && (
									<>
										<h3 className="text-2xl font-bold text-gray-900 dark:text-white">
											{notification.status || "Notification"}
										</h3>
										<p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">{notification.key}</p>
									</>
								)}
								{!notification && <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Loading...</h3>}
							</div>
						</div>
						<div className="flex items-center gap-3">
							{/* Status Badge */}
							{notification && (
								<Label
									status={notification.status || "PENDING"}
									size="lg">
									{notification.status || "PENDING"}
								</Label>
							)}

							{/* Retry Button (only for FAILED) */}
							{notification?.status === "FAILED" && (
								<Button
									variant="secondary"
									size="sm"
									onClick={handleRetry}>
									Retry
								</Button>
							)}
							<Button
								variant="ghost"
								size="md"
								iconOnly
								onClick={handleClose}>
								<XMarkIcon className="h-6 w-6" />
							</Button>
						</div>
					</div>

					{/* Tabs */}
					<div className="shrink-0 border-b border-gray-200 dark:border-neutral-700">
						<nav className="flex px-6 gap-8">
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
					<div className="flex-1 overflow-y-auto p-6">
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
									onClick={handleClose}>
									Close
								</Button>
							</div>
						) : (
							<Outlet context={{ notification: notification }} />
						)}
					</div>
				</div>
			</div>
		</div>
	);

	return (
		<>
			{createPortal(ModalContent, document.body)}
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
