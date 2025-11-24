import { useOutletContext } from "react-router-dom";
import { Worker } from "@/interfaces/instance";
import { Label, JobCard, InstanceCard } from "@/components";

const InfoTab = () => {
	const { worker } = useOutletContext<{ worker: Worker }>();

	if (!worker) {
		return (
			<div className="text-center py-8">
				<p className="text-gray-500 dark:text-gray-400">Worker data not available</p>
			</div>
		);
	}

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleString();
	};

	return (
		<div className="space-y-6">
			<div className="overflow-hidden rounded-lg border border-gray-200 dark:border-neutral-700 overflow-x-auto">
				<table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
					<tbody className="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
						<tr>
							<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400 w-1/4">
								<span className="font-mono">Key</span>
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-mono">{worker.key}</td>
						</tr>
						<tr>
							<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
								<span className="font-mono">Instance</span>
							</td>
							<td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
								<InstanceCard instanceKey={worker.instance_key} />
							</td>
						</tr>
						{worker.job_key && (
							<tr>
								<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
									<span className="font-mono">Job</span>
								</td>
								<td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
									<JobCard jobKey={worker.job_key} />
								</td>
							</tr>
						)}
						<tr>
							<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
								<span className="font-mono">Created At</span>
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
								{formatDate(worker.created_at)}
							</td>
						</tr>
						<tr>
							<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
								<span className="font-mono">Updated At</span>
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
								{formatDate(worker.updated_at)}
							</td>
						</tr>
						<tr>
							<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
								<span className="font-mono">Status</span>
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
								<Label status={worker.status}>{worker.status}</Label>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default InfoTab;
