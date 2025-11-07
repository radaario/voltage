import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import type { Worker } from "@/interfaces/instance";
import { getWorkerName } from "@/utils/naming";
import Label from "@/components/base/Label/Label";
import { CpuChipIcon } from "@heroicons/react/24/outline";

interface WorkerCardProps {
	workerKey: string;
	onClick?: () => void;
}

const WorkerCard = ({ workerKey, onClick }: WorkerCardProps) => {
	const navigate = useNavigate();
	const { authToken } = useAuth();

	// Fetch specific worker
	const { data: workerResponse } = useQuery<{ data: Worker; metadata?: any }>({
		queryKey: ["worker", workerKey, authToken],
		queryFn: async () => {
			const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/workers?worker_key=${workerKey}&token=${authToken}`);
			if (!res.ok) throw new Error("Failed to fetch worker");
			return res.json();
		},
		enabled: !!workerKey && !!authToken
	});

	const worker = workerResponse?.data;

	// Fetch all workers from the same instance for naming
	const { data: instanceWorkersResponse } = useQuery<{ data: Worker[]; metadata?: any }>({
		queryKey: ["instanceWorkers", worker?.instance_key, authToken],
		queryFn: async () => {
			const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/workers?instance_key=${worker?.instance_key}&token=${authToken}`);
			if (!res.ok) throw new Error("Failed to fetch instance workers");
			return res.json();
		},
		enabled: !!worker?.instance_key && !!authToken
	});

	const workerName = worker && instanceWorkersResponse?.data ? getWorkerName(instanceWorkersResponse.data, worker) : null;

	// Extract worker index number if available (e.g., "Worker #2" -> 2)
	const workerIndex = workerName ? workerName.match(/#(\d+)/)?.[1] : null;
	const displayText = workerName || (workerIndex ? `Worker #${workerIndex}` : "Worker");

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onClick) {
			onClick();
		} else {
			navigate(`/instances/workers/${workerKey}`);
		}
	};

	return (
		<button
			onClick={handleClick}
			className="flex items-center gap-2 p-2 rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600 transition-colors text-left group min-w-0">
			{/* Content */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<CpuChipIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0" />
					<span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
						{displayText}
					</span>
					{worker?.status && <Label size="sm">{worker.status}</Label>}
				</div>
			</div>
		</button>
	);
};

export default WorkerCard;
