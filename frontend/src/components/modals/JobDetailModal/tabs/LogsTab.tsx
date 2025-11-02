import { useOutletContext } from "react-router-dom";
import type { Job } from "@/interfaces/job";

interface OutletContext {
	job: Job;
}

const LogsTab: React.FC = () => {
	const { job } = useOutletContext<OutletContext>();

	return (
		<div>
			<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Logs</h4>
			<p className="text-sm text-gray-600 dark:text-gray-400">Coming soon...</p>
		</div>
	);
};

export default LogsTab;
