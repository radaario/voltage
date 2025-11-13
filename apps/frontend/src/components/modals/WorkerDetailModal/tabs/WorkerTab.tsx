import { useOutletContext } from "react-router-dom";
import { Worker } from "@/interfaces/instance";
import Label from "@/components/base/Label/Label";
import { JobCard, InstanceCard } from "@/components";

const WorkerTab = () => {
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
			<div className="overflow-hidden rounded-lg border border-gray-200 dark:border-neutral-700">
				<table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
					<tbody className="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
						<tr>
							<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400 w-1/4">
								<span className="font-mono">key</span>
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-mono">{worker.key}</td>
						</tr>
						<tr>
							<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
								<span className="font-mono">status</span>
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
								<Label size="md">{worker.status}</Label>
							</td>
						</tr>
						<tr>
							<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
								<span className="font-mono">pid</span>
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-mono">
								{worker.pid ?? "N/A"}
							</td>
						</tr>
						<tr>
							<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
								<span className="font-mono">instance_key</span>
							</td>
							<td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
								<InstanceCard instanceKey={worker.instance_key} />
							</td>
						</tr>
						<tr>
							<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
								<span className="font-mono">job_key</span>
							</td>
							<td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
								{worker.job_key ? (
									<JobCard jobKey={worker.job_key} />
								) : (
									<span className="text-gray-400 dark:text-gray-500">N/A</span>
								)}
							</td>
						</tr>
						<tr>
							<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
								<span className="font-mono">created_at</span>
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
								{formatDate(worker.created_at)}
							</td>
						</tr>
						<tr>
							<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
								<span className="font-mono">updated_at</span>
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
								{formatDate(worker.updated_at)}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default WorkerTab;
