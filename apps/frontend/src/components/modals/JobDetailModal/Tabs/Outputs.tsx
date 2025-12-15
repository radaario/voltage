import { useState, useMemo } from "react";
import { useOutletContext, useNavigate, useParams, Outlet } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { JobOutput } from "@/interfaces/job";
import { useAuth } from "@/hooks/useAuth";
import { api, getFilenameFromPath, ApiResponse, formatDuration, formatDatesToDuration } from "@/utils";
import { ArrowPathIcon, EyeIcon, VideoCameraIcon, PhotoIcon, MusicalNoteIcon, LanguageIcon } from "@heroicons/react/24/outline";
import { ConfirmModal, Label, Tooltip, Button, TimeAgo, LoadingOverlay, EmptyState, MemoizedTableRow } from "@/components";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import type { JobOutletContext } from "@/types/modal";

const columnHelper = createColumnHelper<JobOutput>();

const Outputs: React.FC = () => {
	const { job } = useOutletContext<JobOutletContext>();
	const { jobKey } = useParams<{ jobKey: string }>();
	const navigate = useNavigate();
	const { authToken } = useAuth();
	const queryClient = useQueryClient();

	const { config } = useGlobalStateContext();

	// states
	const [outputToRetry, setOutputToRetry] = useState<JobOutput | null>(null);

	// querys
	// Fetch outputs
	const { data: outputsResponse, isLoading } = useQuery<ApiResponse<JobOutput[]>>({
		queryKey: ["outputs", job.key],
		queryFn: async () => {
			return await api.get<JobOutput[]>("/jobs/outputs", {
				token: authToken || "",
				job_key: job.key
			});
		},
		enabled: !!job.key && !!authToken,
		refetchOnMount: "always"
	});

	// mutations
	// Retry output mutation
	const retryOutputMutation = useMutation({
		mutationFn: async (outputKey: string) => {
			return await api.post("/jobs/outputs/retry", null, {
				params: { token: authToken, output_key: outputKey, job_key: jobKey }
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["outputs", job.key] });
			setOutputToRetry(null);
		}
	});

	// actions
	const handleRetryOutput = (output: JobOutput) => {
		setOutputToRetry(output);
	};

	const handleConfirmRetry = () => {
		if (outputToRetry) {
			retryOutputMutation.mutate(outputToRetry.key);
		}
	};

	const handleCloseRetryModal = () => {
		if (!retryOutputMutation.isPending) {
			setOutputToRetry(null);
		}
	};

	const getOutputTypeIcon = (type: unknown) => {
		const iconClass = "w-4 h-4";
		const typeStr = typeof type === "string" ? type : "";
		switch (typeStr?.toUpperCase()) {
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

	// data
	const outputs = outputsResponse?.data || [];
	const serverTimezone = config?.timezone || "UTC";

	const columns = useMemo(
		() => [
			columnHelper.accessor("index", {
				header: "#",
				cell: (info) => {
					const index = info.getValue();
					return <span className="font-mono text-gray-600 dark:text-gray-400">{index + 1}</span>;
				}
			}),
			columnHelper.display({
				id: "output",
				header: "Output",
				cell: (info) => {
					const output = info.row.original;
					const duration = (output.outcome?.duration as number | undefined) || (output.specs?.duration as number | undefined);

					return (
						<div className="max-w-60">
							{/*<Tooltip
								content={
									<div className="max-w-[500px] py-5 px-5">
										{output.specs?.name && <div>{output.specs.name}</div>}
										<hr className="my-2 opacity-40" />
										<div>{output.key}</div>
										<hr className="my-2 opacity-40" />
										{output.specs?.path && <div>{output.specs.path}</div>}
										<hr className="my-2 opacity-40" />
										{output.outcome?.url && <div>{output.outcome.url}</div>}
									</div>
								}>*/}
							<div>
								<div className="text-gray-500 dark:text-gray-400 font-bold text-xs truncate max-w-50">
									{output.specs?.name || output.key}
								</div>
								<div className="flex flex-wrap text-gray-500 dark:text-gray-400 text-xs">
									<span className="truncate">
										{output.specs?.path && <div>{getFilenameFromPath(output.specs.path)}</div>}
									</span>
									<span>{duration ? `, ${formatDuration(duration)}` : ""}</span>
								</div>
								{/*
									{output.specs?.format && (
										<div className="text-gray-500 dark:text-gray-400 text-xs mt-0.25">{output.specs.format}</div>
									)}
									*/}
							</div>
							{/* </Tooltip> */}
						</div>
					);
				}
			}),
			columnHelper.accessor("specs.type", {
				header: "Type",
				cell: (info) => {
					const type = info.getValue();
					const typeStr = typeof type === "string" ? type : "UNKNOWN";
					return (
						<Label>
							{getOutputTypeIcon(type)}
							{typeStr}
						</Label>
					);
				}
			}),
			// columnHelper.display({
			// 	id: "duration",
			// 	header: "Duration",
			// 	cell: (info) => {
			// 		const output = info.row.original;
			// 		const duration = output.outcome?.duration || output.specs?.duration;
			// 		return duration ? formatDuration(duration) : "-";
			// 	}
			// }),
			columnHelper.display({
				id: "process",
				header: "Process",
				cell: (info) => {
					const output = info.row.original;

					const progressDurationText = formatDatesToDuration(output.started_at, output.processed_at, serverTimezone);
					const progressDuration = progressDurationText ? <span>{progressDurationText}</span> : null;

					const fullDurationText = formatDatesToDuration(output.created_at, output.processed_at, serverTimezone);
					const fullDuration = fullDurationText ? <span>{fullDurationText}</span> : null;

					return (
						<div className="text-right sm:text-left">
							<div>%{job.progress || 0}</div>
							{progressDuration && (
								<Tooltip
									content={
										<table className="py-1.5">
											<tr>
												<td className="font-light pr-1 py-0.25">Progress Duration</td>
												<td>: {progressDuration}</td>
											</tr>
											<tr>
												<td className="font-light pr-1 py-0.25">Completed Duration</td>
												<td>: {fullDuration}</td>
											</tr>
										</table>
									}>
									<div className="inline-flex text-xs text-gray-500 dark:text-gray-400 font-mono">{progressDuration}</div>
								</Tooltip>
							)}
						</div>
					);
				}
			}),
			columnHelper.accessor("status", {
				header: "Status",
				cell: (info) => {
					const status = info.getValue();
					return (
						<Label
							status={status}
							size="sm">
							{status || "PENDING"}
						</Label>
					);
				}
			}),
			columnHelper.accessor("updated_at", {
				header: "Updated At",
				cell: (info) => (
					<div className="text-right sm:text-left sm:min-w-[85px]">
						<TimeAgo
							datetime={info.getValue()}
							className="text-xs"
						/>
					</div>
				)
			}),
			columnHelper.display({
				id: "actions",
				header: "Actions",
				cell: (info) => {
					const output = info.row.original;
					return (
						<div className="flex items-center justify-end sm:justify-start gap-2">
							<Tooltip content="Retry">
								<Button
									variant="soft"
									size="sm"
									iconOnly
									onClick={(e) => {
										e.stopPropagation();
										handleRetryOutput(output);
									}}
									disabled={
										!["QUEUED", "COMPLETED", "CANCELLED", "DELETED", "FAILED", "TIMEOUT"].includes(
											output?.status as string
										) || retryOutputMutation.isPending
									}>
									<ArrowPathIcon className="w-4 h-4" />
								</Button>
							</Tooltip>
							<Tooltip content="View">
								<Button
									variant="soft"
									size="sm"
									iconOnly
									onClick={(e) => {
										e.stopPropagation();
										navigate(`/jobs/${jobKey}/outputs/${output.key}/info`);
									}}>
									<EyeIcon className="w-4 h-4" />
								</Button>
							</Tooltip>
						</div>
					);
				}
			})
		],
		[retryOutputMutation.isPending, jobKey]
	);

	const table = useReactTable({
		data: outputs,
		columns,
		getCoreRowModel: getCoreRowModel()
	});

	return (
		<div className="space-y-4">
			<div className="bg-gray-50 dark:bg-neutral-800 shadow-md rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700">
				<div className="w-full relative">
					{/* Loading Overlay */}
					<LoadingOverlay show={isLoading} />

					<div className="overflow-x-auto">
						<table className="responsive-table min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
							<thead className="bg-gray-50 dark:bg-neutral-800">
								{table.getHeaderGroups().map((headerGroup) => (
									<tr key={headerGroup.id}>
										{headerGroup.headers.map((header) => (
											<th
												key={header.id}
												scope="col"
												className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
												{flexRender(header.column.columnDef.header, header.getContext())}
											</th>
										))}
									</tr>
								))}
							</thead>
							<tbody className="bg-white dark:bg-neutral-900 divide-y divide-gray-200 dark:divide-neutral-800">
								{table.getRowModel().rows.length === 0 ? (
									<EmptyState
										message="No outputs configured for this job"
										colSpan={columns.length}
									/>
								) : (
									table.getRowModel().rows.map((row) => {
										const output = row.original;
										return (
											<MemoizedTableRow
												key={row.id}
												row={row}
												onClick={() => navigate(`/jobs/${jobKey}/outputs/${output.key}/info`)}
											/>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			{/* Retry Confirmation Modal */}
			{outputToRetry && (
				<ConfirmModal
					isOpen={!!outputToRetry}
					onClose={handleCloseRetryModal}
					onConfirm={handleConfirmRetry}
					title="Retry Output"
					message={
						<>
							<p className="mb-4">Are you sure you want to retry this output?</p>
							<ul className="list-disc list-inside space-y-1 mb-4 text-sm">
								<li>{outputToRetry.key}</li>
							</ul>
						</>
					}
					confirmText="Retry"
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

export default Outputs;
