import { CalendarIcon, ChartBarIcon, KeyIcon, ClipboardDocumentIcon, HashtagIcon } from "@heroicons/react/24/outline";
import { JobCard, WorkerCard, InstanceCard, Label, TimeAgo } from "@/components";
import { copyToClipboard, getCountryFromIP } from "@/utils";
import { useState, useEffect } from "react";

interface TableKeyValuePreviewProps {
	data: Record<string, unknown>;
	excludedKeys?: string[];
	langMap?: Record<string, string>;
}

// Default language map for common keys
const DEFAULT_LANG_MAP: Record<string, string> = {
	job_key: "Job",
	instance_key: "Instance",
	worker_key: "Worker",
	created_at: "Created At",
	updated_at: "Updated At",
	analyzed_at: "Analyzed At",
	started_at: "Started At",
	completed_at: "Completed At"
};

const TableKeyValuePreview: React.FC<TableKeyValuePreviewProps> = ({ data, excludedKeys = [], langMap = {} }) => {
	const [countryCode, setCountryCode] = useState<string>("");
	const [copiedKey, setCopiedKey] = useState<string | null>(null);

	// Merge default and custom lang maps
	const finalLangMap = { ...DEFAULT_LANG_MAP, ...langMap };

	useEffect(() => {
		if (data.ip_address && typeof data.ip_address === "string") {
			getCountryFromIP(data.ip_address).then((result) => {
				setCountryCode(result?.countryCode || "");
			});
		}
	}, [data.ip_address]);

	const formatKey = (key: string) => {
		// Check if there's a custom translation in langMap
		if (finalLangMap[key]) {
			return finalLangMap[key];
		}

		// Otherwise, use the default formatting
		return key
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	};

	const isDateKey = (key: string) => {
		return key.includes("_at") || key.toLowerCase().includes("date");
	};

	const renderValue = (key: string, value: unknown, fullData: Record<string, unknown>): React.ReactNode => {
		// JobCard for job_key
		if (key === "job_key" && typeof value === "string") {
			return <JobCard jobKey={value} />;
		}

		// WorkerCard for worker_key
		if (key === "worker_key" && typeof value === "string") {
			return (
				<WorkerCard
					workerKey={value}
					instanceKey={typeof fullData.instance_key === "string" ? fullData.instance_key : undefined}
				/>
			);
		}

		// InstanceCard for instance_key
		if (key === "instance_key" && typeof value === "string") {
			return <InstanceCard instanceKey={value} />;
		}

		// Label for status or type fields
		if (["status", "type"].includes(key) && typeof value === "string") {
			return <Label status={value}>{value}</Label>;
		}

		// IP Address with country flag
		if (key === "ip_address" && typeof value === "string") {
			return (
				<div className="flex items-center gap-2">
					{countryCode && (
						<img
							src={`https://flagcdn.com/w20/${countryCode.toLowerCase()}.png`}
							alt={countryCode}
							className="w-4 h-auto rounded shadow-sm"
						/>
					)}
					<span className="font-mono">{value}</span>
				</div>
			);
		}

		// Key visualization with icon and copy button
		if (key === "key" && typeof value === "string") {
			const handleCopy = async () => {
				const success = await copyToClipboard(value);
				if (success) {
					setCopiedKey(value);
					setTimeout(() => setCopiedKey(null), 2000);
				}
			};

			return (
				<div className="flex items-center gap-2">
					<KeyIcon className="h-4 w-4 text-gray-400" />
					<span className="font-mono text-sm text-gray-800 dark:text-gray-200">{value}</span>
					<button
						onClick={handleCopy}
						className="ml-0.5 p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
						title="Copy key">
						<ClipboardDocumentIcon
							className={`h-4 w-4 ${
								copiedKey === value ? "text-green-500" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
							}`}
						/>
					</button>
				</div>
			);
		}

		// Numbers with icon
		if (typeof value === "number" && key === "index") {
			return (
				<span className="inline-flex items-center gap-1">
					<HashtagIcon className="h-4 w-4 text-gray-400" />
					<span className="font-medium text-gray-800 dark:text-gray-200">{value + 1}</span>
				</span>
			);
		}

		// Numbers with icon
		if (typeof value === "number") {
			return (
				<span className="inline-flex items-center gap-1">
					<ChartBarIcon className="h-4 w-4 text-gray-400" />
					<span className="font-medium text-gray-800 dark:text-gray-200">{value}</span>
				</span>
			);
		}

		// Dates with icon
		if (isDateKey(key) && typeof value === "string") {
			return (
				<span className="inline-flex items-center gap-1">
					<CalendarIcon className="h-4 w-4 text-gray-400" />
					<TimeAgo datetime={value} />
				</span>
			);
		}

		// Booleans
		if (typeof value === "boolean") {
			return value ? "Yes" : "No";
		}

		// Strings
		if (typeof value === "string") {
			// If it's a key field, use mono font
			if (key.includes("_key") || key === "key") {
				return <span className="font-mono text-xs text-gray-800 dark:text-gray-200">{value}</span>;
			}
			return <span className="font-mono text-gray-800 dark:text-gray-200">{value}</span>;
		}

		// Objects/Arrays
		if (typeof value === "object" && value !== null) {
			return <span className="text-xs text-gray-500 dark:text-gray-400">{JSON.stringify(value, null, 2)}</span>;
		}

		return <span className="text-gray-500 dark:text-gray-400">N/A</span>;
	};

	// Filter out excluded keys and null/undefined values
	const entries = Object.entries(data).filter(([key, value]) => !excludedKeys.includes(key) && value !== undefined && value !== null);

	if (entries.length === 0) {
		return (
			<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-8 text-center">
				<p className="text-gray-500 dark:text-gray-400">No data available</p>
			</div>
		);
	}

	return (
		<div className="overflow-hidden border border-gray-200 dark:border-neutral-700 rounded-lg overflow-x-auto">
			<table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
				<tbody className="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
					{entries.map(([key, value]) => (
						<tr
							key={key}
							className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
							<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase">
								{formatKey(key)}
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{renderValue(key, value, data)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

export default TableKeyValuePreview;
