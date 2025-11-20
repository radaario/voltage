import { useOutletContext } from "react-router-dom";
import { CalendarIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import Label from "@/components/base/Label/Label";
import type { JobOutput } from "@/interfaces/job";

interface OutletContext {
	output: JobOutput;
}

const InfoTab: React.FC = () => {
	const { output } = useOutletContext<OutletContext>();

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
		// Status Label
		if (key === "Status" && typeof value === "string") {
			return <Label status={value}>{value}</Label>;
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
		{ key: "Key", value: output.key },
		{ key: "Index", value: output.index },
		{ key: "Status", value: output.status },
		{ key: "Updated At", value: output.updated_at }
	];

	return (
		<div className="space-y-6">
			{/* Info Table */}
			<div className="overflow-hidden border border-gray-200 dark:border-neutral-700 rounded-lg overflow-x-auto">
				<table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
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
		</div>
	);
};

export default InfoTab;
