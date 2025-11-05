import { useOutletContext } from "react-router-dom";
import type { Job } from "@/interfaces/job";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";

interface OutletContext {
	job: Job;
}

const LogsTab: React.FC = () => {
	const { job } = useOutletContext<OutletContext>();

	return (
		<div className="flex flex-col items-center justify-center py-12 space-y-4">
			<div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
				<ExclamationCircleIcon className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
			</div>
			<div className="text-center space-y-2">
				<h4 className="text-lg font-semibold text-gray-900 dark:text-white">Logs Not Available</h4>
				<p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
					The logs endpoint is not yet implemented on the backend. Please check back later or contact your administrator.
				</p>
				<p className="text-xs text-gray-500 dark:text-gray-500 font-mono mt-4">Job Key: {job.key}</p>
			</div>
		</div>
	);
};

export default LogsTab;
