import { useState } from "react";
import { useOutletContext, useNavigate, useParams, Outlet } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Job } from "@/interfaces/job";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/utils";
import { ArrowUturnLeftIcon, EyeIcon, VideoCameraIcon, PhotoIcon, MusicalNoteIcon, LanguageIcon } from "@heroicons/react/24/outline";
import { ConfirmModal, Label, Tooltip, TimeAgo } from "@/components";

interface OutletContext {
	job: Job;
}

const OutputsTab: React.FC = () => {
	const { job } = useOutletContext<OutletContext>();
	const { jobKey } = useParams<{ jobKey: string }>();
	const navigate = useNavigate();
	const { authToken } = useAuth();
	const queryClient = useQueryClient();
	const [outputToRetry, setOutputToRetry] = useState<{ key: string; index: number } | null>(null);

	// Retry output mutation
	const retryOutputMutation = useMutation({
		mutationFn: async (outputKey: string) => {
			return await api.post("/jobs/retry", null, {
				params: { token: authToken, output_key: outputKey, job_key: jobKey }
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["job", job.key] });
		}
	});

	const handleRetryOutput = (outputKey: string, index: number) => {
		setOutputToRetry({ key: outputKey, index });
	};

	const handleConfirmRetry = () => {
		if (outputToRetry) {
			retryOutputMutation.mutate(outputToRetry.key);
			setOutputToRetry(null);
		}
	};

	const handleCloseRetryModal = () => {
		if (!retryOutputMutation.isPending) {
			setOutputToRetry(null);
		}
	};

	const getOutputTypeIcon = (type: string) => {
		const iconClass = "w-4 h-4";
		switch (type?.toUpperCase()) {
			case "VIDEO":
				return <VideoCameraIcon className={iconClass} />;
			case "THUMBNAIL":
				return <PhotoIcon className={iconClass} />;
			case "AUDIO":
				return <MusicalNoteIcon className={iconClass} />;
			case "SUBTITLE":
				return <LanguageIcon className={iconClass} />;
			default:
				return null;
		}
	};

	const outputs = job.outputs || [];

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
				<div className="overflow-hidden border border-gray-200 dark:border-neutral-700 rounded-lg overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
						<thead className="bg-gray-50 dark:bg-neutral-900">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									#
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Type
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Specs
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Status
								</th>
								{/*
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Outcome
								</th>
								*/}
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Updated At
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
									onClick={() => navigate(`/jobs/${jobKey}/outputs/${output.key}/info`)}
									className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors cursor-pointer">
									<td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600 dark:text-gray-400">
										{output.index + 1}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
										<div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800">
											{getOutputTypeIcon(output.specs?.type)}
											{output.specs?.type || "UNKNOWN"}
										</div>
									</td>
									<td className="px-6 py-4 text-sm">
										{output.specs?.path && (
											<div className="text-gray-500 dark:text-gray-400 text-xs mt-1">{output.specs.path}</div>
										)}
										{output.specs?.format && (
											<div className="text-gray-500 dark:text-gray-400 text-xs mt-1">{output.specs.format}</div>
										)}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm">
										<Label status={output.status}>{output.status}</Label>
									</td>
									{/*
									<td className="px-6 py-4 text-sm max-w-xs">
										{output.outcome ? (
											<div className="text-gray-900 dark:text-gray-100 font-mono text-xs break-all">
												{formatResult(output.outcome)}
											</div>
										) : output.error ? (
											<div className="text-red-600 dark:text-red-400 text-xs">
												{output.error.message || "Error occurred"}
											</div>
										) : (
											<span className="text-gray-400 dark:text-gray-500 text-xs">-</span>
										)}
									</td>
									*/}
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
										<TimeAgo datetime={output.updated_at} />
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm">
										<div className="flex items-center gap-1">
											<Tooltip content="Retry">
												<button
													onClick={(e) => {
														e.stopPropagation();
														handleRetryOutput(output.key, output.index);
													}}
													disabled={
														!["FAILED"].includes(output?.status as string) || retryOutputMutation.isPending
													}
													className="p-1.5 bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-600 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
													<ArrowUturnLeftIcon
														className={`w-4 h-4 ${retryOutputMutation.isPending ? "animate-spin" : ""}`}
													/>
												</button>
											</Tooltip>
											<Tooltip content="View">
												<button
													onClick={(e) => {
														e.stopPropagation();
														navigate(`/jobs/${jobKey}/outputs/${output.key}/info`);
													}}
													className="p-1.5 bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-600 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors">
													<EyeIcon className="w-4 h-4" />
												</button>
											</Tooltip>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Retry Confirmation Modal */}
			{outputToRetry && (
				<ConfirmModal
					isOpen={!!outputToRetry}
					onClose={handleCloseRetryModal}
					onConfirm={handleConfirmRetry}
					title="Retry Output"
					message={
						<>
							Are you sure you want to retry <strong>Output #{outputToRetry.index + 1}</strong>?
						</>
					}
					confirmText="Retry Output"
					variant="info"
					isLoading={retryOutputMutation.isPending}
					loadingText="Retrying"
				/>
			)}

			{/* Nested Outlet for OutputDetailModal */}
			<Outlet context={{ job }} />
		</div>
	);
};

export default OutputsTab;
