import { useOutletContext } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Job } from "@/interfaces/job";
import { formatDate } from "@/utils";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import { CheckCircleIcon, XCircleIcon, ClockIcon, ArrowPathIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";

interface OutletContext {
	job: Job;
}

const OutputsTab: React.FC = () => {
	const { job } = useOutletContext<OutletContext>();
	const { authToken } = useAuth();
	const { config } = useGlobalStateContext();
	const queryClient = useQueryClient();

	// Retry output mutation
	const retryOutputMutation = useMutation({
		mutationFn: async (outputKey: string) => {
			const params = new URLSearchParams();
			params.append("token", authToken || "");
			params.append("output_key", outputKey);

			const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/jobs/retry?${params}`, {
				method: "POST"
			});

			if (!response.ok) {
				throw new Error("Failed to retry output");
			}

			return await response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["job", job.key] });
		}
	});

	const handleRetryOutput = (outputKey: string) => {
		if (window.confirm("Are you sure you want to retry this output?")) {
			retryOutputMutation.mutate(outputKey);
		}
	};

	const outputs = job.outputs || [];

	const getStatusColor = (status: string) => {
		switch (status) {
			case "COMPLETED":
				return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
			case "FAILED":
			case "CANCELLED":
				return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
			case "ENCODING":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
			case "UPLOADING":
				return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
			case "PENDING":
				return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
			default:
				return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "COMPLETED":
				return <CheckCircleIcon className="w-4 h-4" />;
			case "FAILED":
			case "CANCELLED":
				return <XCircleIcon className="w-4 h-4" />;
			case "ENCODING":
				return <ArrowPathIcon className="w-4 h-4 animate-spin" />;
			case "UPLOADING":
				return <ArrowUpTrayIcon className="w-4 h-4" />;
			case "PENDING":
				return <ClockIcon className="w-4 h-4" />;
			default:
				return <ClockIcon className="w-4 h-4" />;
		}
	};

	const formatSpecs = (specs: any) => {
		if (!specs) return "-";
		const parts = [];
		if (specs.container) parts.push(specs.container.toUpperCase());
		if (specs.videoCodec) parts.push(specs.videoCodec);
		if (specs.width && specs.height) parts.push(`${specs.width}x${specs.height}`);
		if (specs.videoBitrate) parts.push(specs.videoBitrate);
		if (specs.audioCodec) parts.push(specs.audioCodec);
		if (specs.audioBitrate) parts.push(specs.audioBitrate);
		return parts.length > 0 ? parts.join(" • ") : "-";
	};

	const formatResult = (result: any) => {
		if (!result) return "-";
		if (result.url) return result.url;
		if (result.file_name) return result.file_name;
		if (result.path) return result.path;
		return JSON.stringify(result);
	};

	return (
		<div className="space-y-4">
			{/*
			<div className="flex items-center justify-between">
				<h4 className="text-lg font-semibold text-gray-900 dark:text-white">Outputs</h4>
				<span className="text-sm text-gray-600 dark:text-gray-400">{outputs.length} output(s)</span>
			</div>
			*/}

			{outputs.length === 0 ? (
				<div className="text-center py-12">
					<p className="text-sm text-gray-600 dark:text-gray-400">No outputs configured for this job.</p>
				</div>
			) : (
				<div className="overflow-hidden border border-gray-200 dark:border-neutral-700 rounded-lg">
					<table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
						<thead className="bg-gray-50 dark:bg-neutral-900">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									#
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Status
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Specs
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Result
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Time
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
							{outputs.map((output) => (
								<tr
									key={output.key}
									className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
									<td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600 dark:text-gray-400">
										{output.index + 1}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm">
										<div className="flex items-center gap-2">
											<span
												className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(output.status)}`}>
												{getStatusIcon(output.status)}
												{output.status}
											</span>
										</div>
									</td>
									<td className="px-6 py-4 text-sm">
										<div className="text-gray-900 dark:text-gray-100 font-mono text-xs">
											{formatSpecs(output.specs)}
										</div>
										{output.specs?.path && (
											<div className="text-gray-500 dark:text-gray-400 text-xs mt-1">Path: {output.specs.path}</div>
										)}
									</td>
									<td className="px-6 py-4 text-sm max-w-xs">
										{output.result ? (
											<div className="text-gray-900 dark:text-gray-100 font-mono text-xs break-all">
												{formatResult(output.result)}
											</div>
										) : output.error ? (
											<div className="text-red-600 dark:text-red-400 text-xs">
												{output.error.message || "Error occurred"}
											</div>
										) : (
											<span className="text-gray-400 dark:text-gray-500 text-xs">-</span>
										)}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
										{formatDate(output.updated_at, config?.timezone || "UTC")}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm">
										<button
											onClick={() => handleRetryOutput(output.key)}
											disabled={retryOutputMutation.isPending}
											className="p-1.5 bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-600 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
											<ArrowPathIcon className={`w-4 h-4 ${retryOutputMutation.isPending ? "animate-spin" : ""}`} />
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Show errors if any */}
			{outputs.some((o) => o.error) && (
				<div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
					<h5 className="text-sm font-semibold text-red-900 dark:text-red-400 mb-2">Errors</h5>
					<div className="space-y-2">
						{outputs
							.filter((o) => o.error)
							.map((output) => (
								<div
									key={output.key}
									className="text-xs">
									<span className="font-mono text-red-700 dark:text-red-300">Output #{output.index + 1}:</span>{" "}
									<span className="text-red-600 dark:text-red-400">
										{output.error?.message || JSON.stringify(output.error)}
									</span>
								</div>
							))}
					</div>
				</div>
			)}
		</div>
	);
};

export default OutputsTab;
