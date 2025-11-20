import { useOutletContext } from "react-router-dom";
import type { Log } from "@/interfaces/log";
import { JobCard, InstanceCard, WorkerCard, NotificationCard } from "@/components";

interface OutletContext {
	log: Log;
}

const MetadataTab: React.FC = () => {
	const { log } = useOutletContext<OutletContext>();

	if (!log) {
		return (
			<div className="flex justify-center items-center py-12">
				<p className="text-sm text-gray-600 dark:text-gray-400">No metadata available.</p>
			</div>
		);
	}

	const entries = Object.entries(log).filter(
		([key, value]) => key !== "message" && key !== "data" && value !== undefined && value !== null
	);
	const dataEntries = log.data && typeof log.data === "object" ? Object.entries(log.data) : [];

	const formatKey = (key: string) =>
		key
			.split("_")
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(" ");

	const formatValue = (value: unknown) => {
		if (typeof value === "boolean") return value ? "Yes" : "No";
		if (typeof value === "number") return String(value);
		if (typeof value === "string") return value;
		if (typeof value === "object") return JSON.stringify(value, null, 2);
		return String(value);
	};

	return (
		<div className="space-y-6">
			{/* Log fields */}
			<div className="border border-gray-200 dark:border-neutral-700 rounded-lg overflow-x-auto">
				<table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
					<thead className="bg-gray-50 dark:bg-neutral-900">
						<tr>
							<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
								Key
							</th>
							<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
								Value
							</th>
						</tr>
					</thead>
					<tbody className="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
						{entries.length === 0 && (
							<tr>
								<td
									className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400"
									colSpan={2}>
									No metadata fields
								</td>
							</tr>
						)}
						{entries.map(([key, value]) => (
							<tr
								key={key}
								className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
								<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">
									{formatKey(key)}
								</td>
								<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
									{key === "job_key" && typeof value === "string" ? (
										<JobCard jobKey={value} />
									) : key === "instance_key" && typeof value === "string" ? (
										<InstanceCard instanceKey={value} />
									) : key === "worker_key" && typeof value === "string" ? (
										<WorkerCard
											workerKey={value}
											instanceKey={log.instance_key}
										/>
									) : key === "notification_key" && typeof value === "string" ? (
										<NotificationCard notificationKey={value} />
									) : key.endsWith("_key") ? (
										<span className="font-mono text-xs">{formatValue(value)}</span>
									) : (
										formatValue(value)
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* Data fields */}
			<div>
				<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Data</h4>
				{dataEntries.length === 0 ? (
					<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-8 text-center overflow-x-auto">
						<p className="text-gray-500 dark:text-gray-400">No data</p>
					</div>
				) : (
					<div className="border border-gray-200 dark:border-neutral-700 rounded-lg overflow-x-auto">
						<table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
							<thead className="bg-gray-50 dark:bg-neutral-900">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
										Key
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
										Value
									</th>
								</tr>
							</thead>
							<tbody className="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
								{dataEntries.map(([key, value]) => (
									<tr
										key={key}
										className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
										<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">
											{formatKey(key)}
										</td>
										<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
											{typeof value === "object" ? (
												<pre className="text-xs font-mono whitespace-pre-wrap">
													{JSON.stringify(value, null, 2)}
												</pre>
											) : (
												String(value)
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
};

export default MetadataTab;
