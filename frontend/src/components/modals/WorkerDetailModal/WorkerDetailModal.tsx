import { useParams, useNavigate, NavLink, Outlet } from "react-router-dom";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { XMarkIcon, CpuChipIcon, DocumentChartBarIcon } from "@heroicons/react/24/outline";
import { Worker } from "@/interfaces/instance";
import Label from "@/components/base/Label/Label";
import { useAuth } from "@/hooks/useAuth";
import { getWorkerName } from "@/utils/naming";

const WorkerDetailModal = () => {
	const { workerKey } = useParams<{ workerKey: string }>();
	const navigate = useNavigate();
	const { authToken } = useAuth();

	// Fetch specific worker
	const { data: worker, isLoading } = useQuery<Worker>({
		queryKey: ["worker", workerKey, authToken],
		queryFn: async () => {
			const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/workers?worker_key=${workerKey}&token=${authToken}`);
			if (!res.ok) throw new Error("Failed to fetch worker");
			const json = await res.json();
			return json.data;
		},
		enabled: !!workerKey && !!authToken,
		refetchInterval: 5000
	});

	// Fetch all workers from the same instance for naming
	const { data: instanceWorkers } = useQuery<{ data: Worker[] }>({
		queryKey: ["instanceWorkers", worker?.instance_key, authToken],
		queryFn: async () => {
			const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/workers?instance_key=${worker?.instance_key}&token=${authToken}`);
			if (!res.ok) throw new Error("Failed to fetch instance workers");
			return res.json();
		},
		enabled: !!worker?.instance_key && !!authToken
	});

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
		{ path: "worker", label: "Worker", icon: CpuChipIcon },
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
				<div className="shrink-0 flex items-center justify-between p-6 border-b border-gray-200 dark:border-neutral-700">
					<div className="flex items-center gap-3">
						<CpuChipIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
						{worker && instanceWorkers?.data ? (
							<>
								<h2 className="text-xl font-semibold text-gray-900 dark:text-white">
									{getWorkerName(instanceWorkers.data, worker)}
								</h2>
								<Label size="md">{worker.status}</Label>
								<span className="text-sm text-gray-500 dark:text-gray-400 font-mono">({worker.key})</span>
							</>
						) : (
							<h2 className="text-xl font-semibold text-gray-900 dark:text-white">Worker Detail</h2>
						)}
					</div>
					<button
						onClick={handleClose}
						className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors">
						<XMarkIcon className="h-6 w-6" />
					</button>
				</div>

				{/* Tabs Navigation */}
				<div className="shrink-0 border-b border-gray-200 dark:border-neutral-700">
					<nav className="flex -mb-px px-6">
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
					{isLoading ? (
						<div className="flex justify-center items-center py-12">
							<div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
						</div>
					) : worker ? (
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
