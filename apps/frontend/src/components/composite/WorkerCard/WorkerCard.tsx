import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse, clsx } from "@/utils";
import type { Worker, Instance } from "@/interfaces/instance";
import { getWorkerName, getInstanceName } from "@/utils/naming";
import { CpuChipIcon } from "@heroicons/react/24/outline";

interface WorkerCardProps {
	workerKey?: string | null | undefined;
	instanceKey?: string | null | undefined;
	short?: boolean;
	onClick?: () => void;
	className?: string;
}

const WorkerCard = ({ workerKey, instanceKey, short = false, onClick, className = "" }: WorkerCardProps) => {
	const navigate = useNavigate();
	const { authToken } = useAuth();

	// Fetch all instances (which include workers array)
	const { data: instancesResponse } = useQuery<ApiResponse<Instance[]>>({
		queryKey: ["instances", authToken],
		queryFn: () => api.get<Instance[]>("/instances", { token: authToken }),
		enabled: !!authToken
	});

	// Find the worker from all instances' workers arrays
	const worker = (() => {
		if (!instancesResponse?.data) return undefined;

		for (const instance of instancesResponse.data) {
			if (instance.workers) {
				const foundWorker = instance.workers.find((w: Worker) => w.key === workerKey);
				if (foundWorker) return foundWorker;
			}
		}
		return undefined;
	})();

	// Find the instance that contains this worker
	const workerInstance = instancesResponse?.data?.find((instance) => instance.workers?.some((w: Worker) => w.key === workerKey));

	// Collect all workers for naming context
	const allWorkers = instancesResponse?.data?.flatMap((instance) => instance.workers || []) || [];

	const workerName = worker && allWorkers.length > 0 ? getWorkerName(allWorkers, worker) : null;

	// Get instance name or key
	const instanceDisplayName = (() => {
		if (!workerInstance) return instanceKey;

		// Try to get instance name using naming utility
		if (instancesResponse?.data) {
			const name = getInstanceName(instancesResponse.data, workerInstance);
			if (name) return name;
		}

		// Fallback to instance key
		return workerInstance.key;
	})(); // Extract worker index number if available (e.g., "Worker #2" -> 2)
	const workerIndex = workerName ? workerName.match(/#(\d+)/)?.[1] : null;
	const displayText = workerName || (workerIndex ? `Worker #${workerIndex}` : `Worker`);

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onClick) {
			onClick();
		} else {
			navigate(`/instances/workers/${workerKey}/info`);
		}
	};

	return (
		<button
			onClick={handleClick}
			disabled={!worker}
			className={clsx(
				"flex items-center gap-2 p-2 rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800  transition-colors text-left group min-w-0",
				{
					"hover:bg-gray-50 dark:hover:bg-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600": !!worker
				},
				className
			)}>
			{/* Content */}
			<div className="flex-1 min-w-0">
				<div
					className={clsx("flex gap-2", {
						"items-center": short
					})}>
					<CpuChipIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0" />
					<div>
						{!short && <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">{instanceDisplayName}</div>}
						{!short && <div className="text-sm font-medium text-gray-900 dark:text-white transition-colors">{displayText}</div>}
						<div className="text-[10px] text-gray-500 dark:text-white transition-colors">{worker?.key || workerKey}</div>
					</div>
				</div>
			</div>
		</button>
	);
};

export default WorkerCard;
