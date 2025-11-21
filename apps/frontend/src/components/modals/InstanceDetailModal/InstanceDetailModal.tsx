import { NavLink, Outlet, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { InformationCircleIcon, ServerIcon, UsersIcon, DocumentChartBarIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { useRouteModal } from "@/hooks/useRouteModal";
import { api, ApiResponse } from "@/utils";
import type { Instance } from "@/interfaces/instance";
import { Modal, Label, Button } from "@/components";
import { getInstanceName } from "@/utils/naming";

const InstanceDetailModal: React.FC = () => {
	const { instanceKey } = useParams<{ instanceKey: string }>();
	const { authToken } = useAuth();
	const modalProps = useRouteModal({ navigateBackTo: "/instances", id: "InstanceDetailModal" });

	// Fetch instances and find the specific one
	const { data: instancesResponse, isLoading } = useQuery<ApiResponse<Instance[]>>({
		queryKey: ["instances", authToken],
		queryFn: () => api.get<Instance[]>("/instances", { token: authToken }),
		enabled: !!instanceKey && !!authToken
	});

	const instance = instancesResponse?.data?.find((inst) => inst.key === instanceKey);

	const tabs = [
		{ path: "info", label: "Info", icon: InformationCircleIcon },
		{ path: "workers", label: "Workers", icon: UsersIcon },
		{ path: "specs", label: "Specs", icon: DocumentChartBarIcon }
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
										<h3 className="text-2xl font-bold text-gray-900 dark:text-white">
											{getInstanceName(instancesResponse.data, instance)}
										</h3>
										<Label variant={instance.type === "MASTER" ? "purple" : "blue"}>{instance.type || "UNKNOWN"}</Label>
										<Label status={instance.status}>{instance.status}</Label>
									</div>
									<p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono truncate">{instance.key}</p>
								</>
							) : (
								<h3 className="text-2xl font-bold text-gray-900 dark:text-white">Loading...</h3>
							)}
						</div>
					</div>
					<div className="flex items-center gap-3 shrink-0 ml-4">
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
