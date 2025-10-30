import { useOutletContext } from "react-router-dom";
import {
	LinkIcon,
	DocumentTextIcon,
	ClockIcon,
	TagIcon,
	ArrowTopRightOnSquareIcon,
	ArrowsPointingOutIcon
} from "@heroicons/react/24/outline";
import type { Job } from "@/interfaces/job";
import { useAuth } from "@/hooks/useAuth";

interface OutletContext {
	job: Job;
}

const InputTab: React.FC = () => {
	const { job } = useOutletContext<OutletContext>();
	const { authToken } = useAuth();

	// Convert input object to key-value pairs
	const inputEntries = job?.input ? Object.entries(job.input).filter(([_, value]) => value !== undefined && value !== null) : [];

	const truncateMiddle = (str: string, max = 48) => {
		if (str.length <= max) return str;
		const half = Math.floor((max - 3) / 2);
		return `${str.slice(0, half)}...${str.slice(-half)}`;
	};

	const isUrl = (v: string) => /^https?:\/\//i.test(v);
	const isUUID = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
	const isHexHash = (v: string) => /^[0-9a-f]{32,128}$/i.test(v);
	const isFilePath = (v: string) => /[\\/]/.test(v) && /\.[a-z0-9]{1,5}$/i.test(v);
	const isIsoDate = (v: string) => !isNaN(Date.parse(v));

	const getExt = (v: string) => v.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase() || "";
	const isVideoExt = (ext: string) => ["mp4", "mov", "mkv", "webm", "avi", "m4v"].includes(ext);

	const formatNumberShort = (n: number) => {
		const abs = Math.abs(n);
		if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`; // billions
		if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
		return n.toLocaleString();
	};

	const formatBytes = (bytes: number) => {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB", "TB"] as const;
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
	};

	const formatDuration = (ms: number) => {
		const s = Math.floor(ms / 1000);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		if (h) return `${h}h ${m}m ${sec}s`;
		if (m) return `${m}m ${sec}s`;
		return `${sec}s`;
	};

	const renderValue = (key: string, value: unknown) => {
		// Booleans -> colored label
		if (typeof value === "boolean") {
			return (
				<span
					className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${
						value
							? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
							: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
					}`}>
					<TagIcon className="h-3.5 w-3.5" />
					{value ? "TRUE" : "FALSE"}
				</span>
			);
		}

		// Numbers -> compact + tooltip
		if (typeof value === "number") {
			const isResolutionKey = /(video_)?(width|height|resolution)/i.test(key);
			if (isResolutionKey) {
				return (
					<span
						title={value.toString()}
						className="inline-flex items-center gap-1">
						<ArrowsPointingOutIcon className="h-4 w-4 text-gray-400" />
						<span className="font-medium text-gray-800 dark:text-gray-200">{value}</span>
					</span>
				);
			}

			const showBytes = /bytes?|size|length/i.test(key);
			const compact = showBytes ? formatBytes(value) : formatNumberShort(value);
			return (
				<span
					title={value.toString()}
					className="font-medium text-gray-800 dark:text-gray-200">
					{compact}
				</span>
			);
		}

		// Strings heuristics
		if (typeof value === "string") {
			const ext = getExt(value);
			const isFileNameKey = /^(file_?name|filename|input_file)$/i.test(key);
			if (isUrl(value)) {
				const label = truncateMiddle(value, 56);
				return (
					<a
						href={value}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline"
						title={value}>
						<LinkIcon className="h-4 w-4" />
						<span>{label}</span>
						<ArrowTopRightOnSquareIcon className="h-4 w-4" />
						{isVideoExt(ext) && (
							<span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
								{ext.toUpperCase()}
							</span>
						)}
					</a>
				);
			}

			if (isFilePath(value)) {
				const fileChip = isVideoExt(ext) ? (
					<span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
						{ext.toUpperCase()}
					</span>
				) : null;

				// If this is the main file name, try to show preview thumbnail
				if (isFileNameKey && authToken) {
					return (
						<div className="flex items-center gap-3">
							<div className="w-20 h-14 relative shrink-0 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
								<img
									src={`${import.meta.env.VITE_API_BASE_URL}/jobs/${job.key}/preview?token=${authToken}`}
									alt="Preview"
									className="w-full h-full object-cover"
									onError={(e) => {
										const target = e.target as HTMLImageElement;
										target.style.display = "none";
									}}
								/>
							</div>
							<span
								className="inline-flex items-center gap-1"
								title={value}>
								<DocumentTextIcon className="h-4 w-4 text-gray-400" />
								<span className="font-mono">{truncateMiddle(value, 56)}</span>
								{fileChip}
							</span>
						</div>
					);
				}

				return (
					<span
						className="inline-flex items-center gap-1"
						title={value}>
						<DocumentTextIcon className="h-4 w-4 text-gray-400" />
						<span className="font-mono">{truncateMiddle(value, 56)}</span>
						{fileChip}
					</span>
				);
			}

			if (/duration|_ms$|_millis|_seconds?$|_secs?$/i.test(key)) {
				// assume milliseconds if ends with _ms/_millis; otherwise seconds
				const millis = /_ms$|_millis/i.test(key) ? Number(value) : Number(value) * 1000;
				if (!isNaN(millis)) {
					return (
						<span
							className="inline-flex items-center gap-1"
							title={`${millis} ms`}>
							<ClockIcon className="h-4 w-4 text-gray-400" />
							<span className="font-medium text-gray-800 dark:text-gray-200">{formatDuration(millis)}</span>
						</span>
					);
				}
			}

			if (isIsoDate(value)) {
				const date = new Date(value);
				return (
					<span
						title={date.toString()}
						className="font-medium text-gray-800 dark:text-gray-200">
						{date.toLocaleString()}
					</span>
				);
			}

			const isHashLike = isUUID(value) || isHexHash(value) || value.length > 56;
			return (
				<span
					title={value}
					className={`inline-flex items-center gap-1 ${isHashLike ? "font-mono" : ""}`}>
					{isHashLike && <DocumentTextIcon className="h-4 w-4 text-gray-400" />}
					<span className="text-gray-800 dark:text-gray-200">{truncateMiddle(value, 56)}</span>
				</span>
			);
		}

		// Objects / Arrays -> compact JSON preview
		if (typeof value === "object") {
			try {
				const json = JSON.stringify(value);
				return (
					<span
						title={json}
						className="inline-flex items-center gap-1">
						<DocumentTextIcon className="h-4 w-4 text-gray-400" />
						<span className="font-mono text-gray-800 dark:text-gray-200">{truncateMiddle(json, 56)}</span>
					</span>
				);
			} catch {
				return <span className="text-gray-500 dark:text-gray-400">[Object]</span>;
			}
		}

		return <span className="text-gray-500 dark:text-gray-400">Unknown</span>;
	};

	if (!job?.input || inputEntries.length === 0) {
		return (
			<div className="text-center py-12">
				<p className="text-gray-500 dark:text-gray-400">No input data available</p>
			</div>
		);
	}

	return (
		<div>
			<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Input Configuration</h4>

			{/* Input Table */}
			<div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg">
				<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
					<thead className="bg-gray-50 dark:bg-gray-900">
						<tr>
							<th
								scope="col"
								className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
								Input Key
							</th>
							<th
								scope="col"
								className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
								Input Value
							</th>
						</tr>
					</thead>
					<tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
						{inputEntries.map(([key, value]) => (
							<tr
								key={key}
								className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
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

export default InputTab;
