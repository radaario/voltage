import { useParams, Outlet, useOutletContext, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { InformationCircleIcon, ClipboardDocumentCheckIcon, DocumentTextIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { useRouteModal } from "@/hooks/useRouteModal";
import { api, ApiResponse } from "@/utils";
import type { Instance } from "@/interfaces/instance";
import { Modal, Label, Button, Tooltip, TabsNavigation } from "@/components";
import { getWorkerName, getInstanceNameForWorker } from "@/utils/naming";

interface ParentOutletContext {
	instance?: Instance;
}

const WorkerDetailModal = () => {
	const { workerKey, instanceKey } = useParams<{ workerKey: string; instanceKey?: string }>();
	const location = useLocation();
	const { authToken } = useAuth();
	const outletContext = useOutletContext<ParentOutletContext>();

	// Determine if we're in standalone mode by checking the URL path
	// Standalone: /instances/workers/:workerKey (direct from instances page)
	// Nested: /instances/:instanceKey/workers/:workerKey (from instance modal)
	const isStandalone = location.pathname.includes("/instances/workers/");

	// Nested modda outlet context'ten instance'ı kullan
	const { data: instancesResponse, isLoading: instancesLoading } = useQuery<ApiResponse<Instance[]>>({
		queryKey: ["instances", authToken],
		queryFn: () =>
			api.get<Instance[]>("/instances", {
				token: authToken || ""
			}),
		enabled: isStandalone && !!workerKey && !!authToken
	});

	// Worker ve instance'ı bul
	const { instance, worker } = useMemo(() => {
		if (isStandalone && instancesResponse?.data) {
			for (const inst of instancesResponse.data) {
				const found = inst.workers?.find((w) => w.key === workerKey);
				if (found) {
					return { instance: inst, worker: found };
				}
			}
			return { instance: null, worker: null };
		}
		return {
			instance: outletContext?.instance || null,
			worker: outletContext?.instance?.workers?.find((w) => w.key === workerKey) || null
		};
	}, [isStandalone, instancesResponse, outletContext, workerKey]);

	const isLoading = isStandalone ? instancesLoading : false;

	if (!workerKey) {
		return null;
	}

	// Determine the back navigation path based on mode
	const navigateBackTo = isStandalone ? `/instances` : `/instances/${instanceKey}/workers`;

	const modalProps = useRouteModal({
		navigateBackTo,
		id: isStandalone ? "StandaloneWorkerDetailModal" : "WorkerDetailModal"
	});

	const tabs = [
		{ path: "info", label: "Info", icon: InformationCircleIcon },
		{ path: "outcome", label: "Outcome", icon: ClipboardDocumentCheckIcon },
		{ path: "logs", label: "Logs", icon: DocumentTextIcon }
	];

	// Get all instances for naming
	const allInstances = isStandalone ? instancesResponse?.data || [] : outletContext?.instance ? [outletContext.instance] : [];
	const workerInstanceName = worker && allInstances.length > 0 ? getInstanceNameForWorker(allInstances, worker) : "";

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
					<div className="flex gap-3 overflow-hidden min-w-0">
						<InformationCircleIcon className="h-6 w-6 text-gray-600 dark:text-gray-400 mt-1.5 shrink-0" />
						{isLoading ? (
							<h2 className="text-xl font-semibold text-gray-900 dark:text-white">Loading...</h2>
						) : worker ? (
							<div className="flex flex-col min-w-0">
								<div className="flex items-center gap-2">
									<h2 className="text-xl sm:font-bold text-gray-900 dark:text-white">
										{instance?.workers ? getWorkerName(instance.workers, worker) : `Worker ${worker.index + 1}`}
									</h2>
									{workerInstanceName && (
										<div className="text-md text-gray-500 dark:text-gray-400">({workerInstanceName})</div>
									)}
								</div>
								<div className="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">{worker.key}</div>
							</div>
						) : (
							<h2 className="text-xl font-semibold text-gray-900 dark:text-white">Worker not found</h2>
						)}
					</div>
					<div className="flex items-center gap-3 shrink-0 ml-4">
						{worker && <Label status={worker.status}>{worker.status}</Label>}
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

			{/* Tabs Navigation - Only show if worker is found */}
			{worker && <TabsNavigation tabs={tabs} />}

			{/* Content */}
			<Modal.Content
				noPadding
				className="h-[60vh]">
				<div className="p-6 h-full overflow-y-auto">
					{isLoading ? (
						<div className="text-center py-12">
							<p className="text-gray-500 dark:text-gray-400">Loading worker data...</p>
						</div>
					) : worker ? (
						<Outlet context={{ worker, instance }} />
					) : (
						<div className="text-center py-12">
							<p className="text-gray-500 dark:text-gray-400">Worker not found</p>
						</div>
					)}
				</div>
			</Modal.Content>
		</Modal>
	);
};

export default WorkerDetailModal;
