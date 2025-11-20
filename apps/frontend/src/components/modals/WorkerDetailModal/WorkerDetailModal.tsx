import { useParams, NavLink, Outlet, useOutletContext } from "react-router-dom";
import { useMemo } from "react";
import { InformationCircleIcon, DocumentChartBarIcon } from "@heroicons/react/24/outline";
import { useRouteModal } from "@/hooks/useRouteModal";
import { Instance } from "@/interfaces/instance";
import { Modal, Label, Button } from "@/components";
import { getWorkerName } from "@/utils/naming";

interface OutletContext {
	instances: Instance[];
}

const WorkerDetailModal = () => {
	const { workerKey } = useParams<{ workerKey: string }>();
	const { instances } = useOutletContext<OutletContext>();
	const modalProps = useRouteModal({ navigateBackTo: "/instances" });

	// Find worker from instances data
	const { worker, instanceWorkers } = useMemo(() => {
		for (const instance of instances) {
			const foundWorker = instance.workers.find((w) => w.key === workerKey);
			if (foundWorker) {
				return { worker: foundWorker, instanceWorkers: instance.workers };
			}
		}
		return { worker: null, instanceWorkers: [] };
	}, [instances, workerKey]);

	if (!workerKey) return null;

	const tabs = [
		{ path: "info", label: "Info", icon: InformationCircleIcon },
		{ path: "outcome", label: "Outcome", icon: DocumentChartBarIcon }
	];

	return (
		<Modal
			{...modalProps}
			height="xl"
			size="4xl">
			{/* Header */}
			<Modal.Header
				onClose={modalProps.handleClose}
				showCloseButton={false}>
				<div className="flex items-start justify-between w-full">
					<div className="flex gap-3 overflow-hidden min-w-0">
						<InformationCircleIcon className="h-6 w-6 text-gray-600 dark:text-gray-400 mt-1.5 shrink-0" />
						{worker ? (
							<div className="flex flex-col min-w-0">
								<div className="flex items-center gap-2">
									<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
										{getWorkerName(instanceWorkers, worker)}
									</h2>
									<Label status={worker.status}>{worker.status}</Label>
								</div>
								<div className="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">{worker.key}</div>
							</div>
						) : (
							<h2 className="text-xl font-semibold text-gray-900 dark:text-white">Worker Detail</h2>
						)}
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
				<nav className="flex px-6 overflow-x-auto">
					{tabs.map((tab) => {
						const Icon = tab.icon;
						return (
							<NavLink
								key={tab.path}
								to={tab.path}
								className={({ isActive }) =>
									`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
										isActive
											? "border-neutral-700 text-gray-900 dark:border-neutral-400 dark:text-white"
											: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
									}`
								}>
								<Icon className="h-5 w-5" />
								{tab.label}
							</NavLink>
						);
					})}
				</nav>
			</div>

			{/* Content */}
			<Modal.Content
				noPadding
				className="h-[60vh]">
				<div className="p-6 h-full overflow-y-auto">
					{worker ? (
						<Outlet context={{ worker }} />
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
