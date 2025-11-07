import { useOutletContext } from "react-router-dom";
import { Worker } from "@/interfaces/instance";

const WorkerOutcomeTab = () => {
	const { worker } = useOutletContext<{ worker: Worker }>();

	if (!worker) {
		return (
			<div className="text-center py-8">
				<p className="text-gray-500 dark:text-gray-400">Worker data not available</p>
			</div>
		);
	}

	const hasOutcome = worker.outcome && Object.keys(worker.outcome).length > 0;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white">Worker Outcome</h3>
			</div>
			{hasOutcome ? (
				<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-4 overflow-auto max-h-[500px]">
					<pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap wrap-break-word">
						{JSON.stringify(worker.outcome, null, 2)}
					</pre>
				</div>
			) : (
				<div className="text-center py-12 bg-gray-50 dark:bg-neutral-900 rounded-lg">
					<p className="text-gray-500 dark:text-gray-400">No outcome data available</p>
				</div>
			)}
		</div>
	);
};

export default WorkerOutcomeTab;
