import { Outlet, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
	InformationCircleIcon,
	ServerIcon,
	CpuChipIcon,
	DocumentChartBarIcon,
	ClipboardDocumentCheckIcon,
	DocumentTextIcon,
	XMarkIcon
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { useRouteModal } from "@/hooks/useRouteModal";
import { api, ApiResponse } from "@/utils";
import type { Instance } from "@/interfaces/instance";
import { Modal, Label, Button, Tooltip, TabsNavigation, LoadingSpinner } from "@/components";
import { getInstanceName } from "@/utils/naming";

const InstanceDetailModal: React.FC = () => {
	const { instanceKey } = useParams<{ instanceKey: string }>();
	const { authToken } = useAuth();
	const modalProps = useRouteModal({ navigateBackTo: "/instances", id: "InstanceDetailModal" });

	// queries
	const { data: instancesResponse, isLoading } = useQuery<ApiResponse<Instance[]>>({
		queryKey: ["instances", authToken],
		queryFn: () => api.get<Instance[]>("/instances", { token: authToken }),
		enabled: !!instanceKey && !!authToken
	});

	// data
	const instance = instancesResponse?.data?.find((inst) => inst.key === instanceKey);

	const tabs = [
		{ path: "info", label: "Info", icon: InformationCircleIcon },
		{ path: "workers", label: "Workers", icon: CpuChipIcon },
		{ path: "specs", label: "Specs", icon: DocumentChartBarIcon },
		{ path: "outcome", label: "Outcome", icon: ClipboardDocumentCheckIcon },
		{ path: "logs", label: "Logs", icon: DocumentTextIcon }
	];

	return (
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
						<ServerIcon className="h-7 w-7 text-gray-600 dark:text-gray-400 mt-0.5 shrink-0" />
						<div className="min-w-0">
							{instance && instancesResponse?.data ? (
								<>
									<div className="flex items-center gap-3 flex-wrap">
										<h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
											{getInstanceName(instancesResponse.data, instance)}
										</h3>
										<Label status={instance.type}>{instance.type}</Label>
									</div>
									<p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono truncate">{instance.key}</p>
								</>
							) : (
								<h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Loading...</h3>
							)}
						</div>
					</div>
					<div className="flex items-center gap-3 shrink-0 ml-4">
						{/* Status Badge */}
						{instance && <Label status={instance.status}>{instance.status}</Label>}
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

			{/* Content */}
			<Modal.Content
				noPadding
				className="h-[60vh]">
				<div className="p-6 h-full overflow-y-auto">
					{isLoading ? (
						<LoadingSpinner />
					) : !instance ? (
						<div className="flex flex-col justify-center items-center py-12 gap-3">
							<p className="text-sm text-gray-600 dark:text-gray-400">Instance not found.</p>
							<Button
								variant="secondary"
								size="sm"
								onClick={modalProps.handleClose}>
								Close
							</Button>
						</div>
					) : (
						<Outlet context={{ instance: instance }} />
					)}
				</div>
			</Modal.Content>
		</Modal>
	);
};

export default InstanceDetailModal;
