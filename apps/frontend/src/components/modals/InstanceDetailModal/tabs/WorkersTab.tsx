import { useOutletContext } from "react-router-dom";
import type { Instance } from "@/interfaces/instance";
import { JobCard } from "@/components";

interface OutletContext {
	instance: Instance;
}

const WorkersTab: React.FC = () => {
	const { instance } = useOutletContext<OutletContext>();

	if (!instance) {
		return (
			<div className="flex justify-center items-center py-12">
				<p className="text-sm text-gray-600 dark:text-gray-400">No instance data available.</p>
			</div>
		);
	}

	if (!instance.workers || instance.workers.length === 0) {
		return (
			<div className="flex justify-center items-center py-12">
				<p className="text-sm text-gray-600 dark:text-gray-400">No workers found for this instance.</p>
			</div>
		);
	}

	return (
		<div className="overflow-hidden border border-gray-200 dark:border-neutral-700 rounded-lg overflow-x-auto">
			<table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
				<thead className="bg-gray-50 dark:bg-neutral-900">
					<tr>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Worker Key
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Status
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							PID
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Job
						</th>
					</tr>
				</thead>
				<tbody className="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
					{instance.workers.map((worker) => (
						<tr
							key={worker.key}
							className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
								<span className="font-mono text-xs">{worker.key}</span>
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
								<span
									className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${
										worker.status === "RUNNING"
											? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
											: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
									}`}>
									{worker.status}
								</span>
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{worker.pid || "N/A"}</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
								{worker.job_key ? <JobCard jobKey={worker.job_key} /> : <span className="text-gray-400">No Job</span>}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

export default WorkersTab;
