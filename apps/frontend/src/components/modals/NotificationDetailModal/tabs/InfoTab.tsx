import { useOutletContext } from "react-router-dom";
import type { Notification } from "@/interfaces/notification";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import { formatDate } from "@/utils";
import { JobCard, WorkerCard, InstanceCard } from "@/components";
import Label from "@/components/base/Label/Label";

interface OutletContext {
	notification: Notification;
}

const InfoTab: React.FC = () => {
	const { notification } = useOutletContext<OutletContext>();
	const { config } = useGlobalStateContext();

	// Check if notification exists
	if (!notification) {
		return (
			<div className="flex justify-center items-center py-12">
				<p className="text-sm text-gray-600 dark:text-gray-400">No notification data available.</p>
			</div>
		);
	}

	// Convert notification object to key-value pairs
	const notificationEntries = Object.entries(notification).filter(
		([key, value]) => value !== undefined && value !== null && !["payload", "outcome", "specs"].includes(key) // Exclude these as they have their own tabs
	);

	const formatValue = (key: string, value: unknown) => {
		// Handle job_key with JobCard
		if (key === "job_key" && typeof value === "string") {
			return <JobCard jobKey={value} />;
		}

		// Handle worker_key with WorkerCard
		if (key === "worker_key" && typeof value === "string") {
			return (
				<WorkerCard
					workerKey={value}
					instanceKey={notification.instance_key}
				/>
			);
		}

		// Handle instance_key with InstanceCard
		if (key === "instance_key" && typeof value === "string") {
			return <InstanceCard instanceKey={value} />;
		}

		// Handle status with Label
		if (key === "status" && typeof value === "string") {
			return <Label status={value}>{value}</Label>;
		}

		// Format dates
		if (key.includes("_at") && typeof value === "string") {
			return formatDate(value, config?.timezone || "UTC");
		}

		// Format booleans
		if (typeof value === "boolean") {
			return value ? "Yes" : "No";
		}

		// Format numbers
		if (typeof value === "number") {
			return value.toString();
		}

		// Format strings
		if (typeof value === "string") {
			return value;
		}

		// Format objects/arrays
		if (typeof value === "object") {
			return JSON.stringify(value, null, 2);
		}

		return String(value);
	};

	const formatKey = (key: string) => {
		return key
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	};

	return (
		<div>
			<div className="overflow-hidden border border-gray-200 dark:border-neutral-700 rounded-lg overflow-x-auto">
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
						{notificationEntries.map(([key, value]) => (
							<tr
								key={key}
								className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
								<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">
									{formatKey(key)}
								</td>
								<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
									{key.includes("_key") ? (
										<span className="font-mono text-xs">{formatValue(key, value)}</span>
									) : (
										formatValue(key, value)
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default InfoTab;
