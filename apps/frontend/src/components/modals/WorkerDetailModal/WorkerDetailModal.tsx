import { useParams, useNavigate, NavLink, Outlet, useOutletContext } from "react-router-dom";
import { createPortal } from "react-dom";
import { useMemo } from "react";
import { XMarkIcon, InformationCircleIcon, DocumentChartBarIcon } from "@heroicons/react/24/outline";
import { Instance } from "@/interfaces/instance";
import Label from "@/components/base/Label/Label";
import Button from "@/components/base/Button/Button";
import { getWorkerName } from "@/utils/naming";

interface OutletContext {
	instances: Instance[];
}

const WorkerDetailModal = () => {
	const { workerKey } = useParams<{ workerKey: string }>();
	const navigate = useNavigate();
	const { instances } = useOutletContext<OutletContext>();

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

	const handleClose = () => {
		navigate("/instances");
	};

	const handleEscape = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			handleClose();
		}
	};

	if (!workerKey) return null;

	const tabs = [
		{ path: "info", label: "Info", icon: InformationCircleIcon },
		{ path: "outcome", label: "Outcome", icon: DocumentChartBarIcon }
	];

	return createPortal(
		<div
			className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm"
			onClick={handleClose}
			onKeyDown={handleEscape}>
			<div
				className="relative w-full max-w-4xl h-[80vh] mx-4 bg-white dark:bg-neutral-800 rounded-lg shadow-xl flex flex-col"
				onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-neutral-700">
					<div className="flex gap-3">
						<InformationCircleIcon className="h-6 w-6 text-gray-600 dark:text-gray-400 mt-1.5" />
						{worker ? (
							<div className="flex flex-col">
								<div className="flex items-center">
									<h2 className="text-2xl font-bold text-gray-900 dark:text-white mr-2">
										{getWorkerName(instanceWorkers, worker)}
									</h2>
									<Label size="md">{worker.status}</Label>
								</div>
								<div className="text-sm text-gray-500 dark:text-gray-400 font-mono">{worker.key}</div>
							</div>
						) : (
							<h2 className="text-xl font-semibold text-gray-900 dark:text-white">Worker Detail</h2>
						)}
					</div>
					<Button
						variant="ghost"
						size="md"
						iconOnly
						onClick={handleClose}>
						<XMarkIcon className="h-6 w-6" />
					</Button>
				</div>

				{/* Tabs Navigation */}
				<div className="shrink-0 border-b border-gray-200 dark:border-neutral-700">
					<nav className="flex -mb-px px-6 overflow-x-auto">
						{tabs.map((tab) => {
							const Icon = tab.icon;
							return (
								<NavLink
									key={tab.path}
									to={tab.path}
									className={({ isActive }) =>
										`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
											isActive
												? "border-blue-500 text-blue-600 dark:text-blue-400"
												: "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-neutral-600"
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
				<div className="flex-1 overflow-y-auto p-6">
					{worker ? (
						<Outlet context={{ worker }} />
					) : (
						<div className="text-center py-12">
							<p className="text-gray-500 dark:text-gray-400">Worker not found</p>
						</div>
					)}
				</div>
			</div>
		</div>,
		document.body
	);
};

export default WorkerDetailModal;
