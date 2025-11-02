import { useOutletContext } from "react-router-dom";
import type { Job } from "@/interfaces/job";

interface OutletContext {
	job: Job;
}

const JobTab: React.FC = () => {
	const { job } = useOutletContext<OutletContext>();

	// Get status badge color
	const getStatusColor = (status: string) => {
		if (status === "COMPLETED") {
			return "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800";
		} else if (status === "FAILED") {
			return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
		} else if (status === "RUNNING" || status === "ENCODING" || status === "DOWNLOADING" || status === "UPLOADING") {
			return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800";
		} else if (status === "PENDING" || status === "QUEUED") {
			return "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800";
		}
		return "bg-gray-100 text-gray-800 border-gray-300 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-700";
	};

	return (
		<div className="space-y-6">
			{/* Basic Info */}
			<div>
				<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Basic Information</h4>
				<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-4 space-y-2">
					<div className="flex justify-between">
						<span className="text-sm text-gray-600 dark:text-gray-400">Job Key:</span>
						<span className="text-sm font-mono text-gray-900 dark:text-white">{job.key}</span>
					</div>
					<div className="flex justify-between items-center">
						<span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
						<span
							className={`inline-flex items-center px-3 py-1 rounded border text-sm font-medium ${getStatusColor(job.status)}`}>
							{job.status}
						</span>
					</div>
					<div className="flex justify-between">
						<span className="text-sm text-gray-600 dark:text-gray-400">Created:</span>
						<span className="text-sm text-gray-900 dark:text-white">{job.created_at || "N/A"}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-sm text-gray-600 dark:text-gray-400">Updated:</span>
						<span className="text-sm text-gray-900 dark:text-white">{job.updated_at || "N/A"}</span>
					</div>
				</div>
			</div>

			{/* Full JSON */}
			<div>
				<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Full Data</h4>
				<pre className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-4 text-xs overflow-x-auto">
					<code className="text-gray-800 dark:text-gray-200">{JSON.stringify(job, null, 2)}</code>
				</pre>
			</div>
		</div>
	);
};

export default JobTab;
