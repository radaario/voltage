import { useOutletContext } from "react-router-dom";
import { TagIcon, ChartBarIcon, CalendarIcon, PlayIcon, CheckCircleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import type { Job } from "@/interfaces/job";
import Label from "@/components/base/Label/Label";
import { InstanceCard } from "@/components/composite/InstanceCard";
import { WorkerCard } from "@/components/composite/WorkerCard";

interface OutletContext {
	job: Job;
}

const InfoTab: React.FC = () => {
	const { job } = useOutletContext<OutletContext>();

	const formatDate = (dateStr: string | null) => {
		if (!dateStr) return "N/A";
		try {
			const date = new Date(dateStr);
			return date.toLocaleString();
		} catch {
			return dateStr;
		}
	};

	const renderValue = (key: string, value: unknown) => {
		// Instance Card
		if (key === "Instance" && job.instance_key) {
			return <InstanceCard instanceKey={job.instance_key} />;
		}

		// Worker Card
		// if (key === "Worker" && job.worker_key) {
		// 	return (
		// 		<WorkerCard
		// 			workerKey={job.worker_key}
		// 			instanceKey={job.instance_key}
		// 		/>
		// 	);
		// }

		// Status Label
		if (key === "Status" && typeof value === "string") {
			return (
				<Label
					status={value}
					size="lg">
					{value}
				</Label>
			);
		}

		// Numbers
		if (typeof value === "number") {
			return (
				<span className="inline-flex items-center gap-1">
					<ChartBarIcon className="h-4 w-4 text-gray-400" />
					<span className="font-medium text-gray-800 dark:text-gray-200">{value}</span>
				</span>
			);
		}

		// Dates
		if (typeof value === "string" && !isNaN(Date.parse(value))) {
			return (
				<span className="inline-flex items-center gap-1">
					<CalendarIcon className="h-4 w-4 text-gray-400" />
					<span className="font-medium text-gray-800 dark:text-gray-200">{formatDate(value)}</span>
				</span>
			);
		}

		// Strings
		if (typeof value === "string") {
			return <span className="font-mono text-gray-800 dark:text-gray-200">{value}</span>;
		}

		return <span className="text-gray-500 dark:text-gray-400">N/A</span>;
	};

	const infoEntries = [
		{ key: "Key", value: job.key, icon: TagIcon },
		// { key: "Worker", value: job.worker_key },
		{ key: "Created At", value: job.created_at, icon: CalendarIcon },
		{ key: "Updated At", value: job.updated_at, icon: CalendarIcon },
		{ key: "Started At", value: job.started_at, icon: PlayIcon },
		{ key: "Completed At", value: job.completed_at, icon: CheckCircleIcon },
		{ key: "Priority", value: job.priority, icon: ChartBarIcon },
		{ key: "Progress", value: job.progress, icon: ArrowPathIcon },
		{ key: "Status", value: job.status }
	];

	const renderJsonSection = (title: string, data: any) => {
		return (
			<div>
				<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h4>
				{data ? (
					<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-4 overflow-auto">
						<pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
							{JSON.stringify(data, null, 2)}
						</pre>
					</div>
				) : (
					<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-8 text-center">
						<p className="text-gray-500 dark:text-gray-400">No {title.toLowerCase()} available</p>
					</div>
				)}
			</div>
		);
	};

	return (
		<div className="space-y-6">
			{/* Info Table */}
			<div className="overflow-hidden border border-gray-200 dark:border-neutral-700 rounded-lg">
				<table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
					{/*
					<thead className="bg-gray-50 dark:bg-neutral-900">
						<tr>
							<th
								scope="col"
								className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
								Key
							</th>
							<th
								scope="col"
								className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
								Value
							</th>
						</tr>
					</thead>
					*/}
					<tbody className="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
						{infoEntries.map(({ key, value }) => (
							<tr
								key={key}
								className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
								<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">
									{key}
								</td>
								<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{renderValue(key, value)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{/* Worker */}
			<WorkerCard
				workerKey={job.worker_key}
				instanceKey={job.instance_key}
				className="w-full"
			/>

			{/* Destination */}
			{renderJsonSection("Destination", job.destination)}

			{/* Notification */}
			{renderJsonSection("Notification", job.notification)}

			{/* Metadata */}
			{renderJsonSection("Metadata", job.metadata)}
		</div>
	);
};

export default InfoTab;
