import { useOutletContext, useNavigate, Outlet, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import type { Worker as IWorker } from "@/interfaces/instance";
import { JobCard, Label, Button, Tooltip, TimeAgo, ConfirmModal } from "@/components";
import { EyeIcon, CpuChipIcon, TrashIcon } from "@heroicons/react/24/outline";
import { getWorkerName } from "@/utils/naming";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/utils";
import type { InstanceOutletContext } from "@/types/modal";

const Workers: React.FC = () => {
	const { instance } = useOutletContext<InstanceOutletContext>();
	const { instanceKey } = useParams<{ instanceKey: string }>();
	const navigate = useNavigate();
	const { authToken } = useAuth();
	const queryClient = useQueryClient();
	const [workerToDelete, setWorkerToDelete] = useState<{ key: string; name: string } | null>(null);

	// Delete worker mutation
	const deleteWorkerMutation = useMutation({
		mutationFn: async (workerKey: string) => {
			return await api.delete("/instances/workers", { token: authToken, worker_key: workerKey });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["instances"] });
			setWorkerToDelete(null);
		}
	});

	const handleDeleteWorker = (worker: IWorker) => {
		setWorkerToDelete({
			key: worker.key,
			name: getWorkerName(instance.workers, worker)
		});
	};

	const handleConfirmDelete = () => {
		if (workerToDelete) {
			deleteWorkerMutation.mutate(workerToDelete.key);
		}
	};

	const handleCloseDeleteModal = () => {
		if (!deleteWorkerMutation.isPending) {
			setWorkerToDelete(null);
		}
	};

	// effects
	useEffect(() => {
		queryClient.invalidateQueries({ queryKey: ["instances"] });
	}, []);

	// renders
	if (!instance) {
		return (
			<div className="flex justify-center items-center py-12">
				<p className="text-sm text-gray-600 dark:text-gray-400">No instance data available.</p>
			</div>
		);
	}

	if (!instance.workers || instance.workers.length === 0) {
		return (
			<div className="flex justify-center items-center py-12">
				<p className="text-sm text-gray-600 dark:text-gray-400">No workers found for this instance.</p>
			</div>
		);
	}

	return (
		<div className="overflow-hidden border border-gray-200 dark:border-neutral-700 rounded-lg overflow-x-auto">
			<table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
				<thead className="bg-gray-50 dark:bg-neutral-900">
					<tr>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							#
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Worker
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Job
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Status
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Updated At
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Actions
						</th>
					</tr>
				</thead>
				<tbody className="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
					{instance.workers.map((worker) => (
						<tr
							key={worker.key}
							onClick={() => navigate(`/instances/${instanceKey}/workers/${worker.key}/info`)}
							className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors cursor-pointer">
							<td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600 dark:text-gray-400">
								{worker.index + 1}
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
								<div className="flex items-start gap-2 min-w-[120px] shrink-0">
									<CpuChipIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 shrink-0 mt-0.5" />
									<div>
										<div className="text-sm text-gray-900 dark:text-white font-bold">
											{getWorkerName(instance.workers, worker)}
										</div>
										<div className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate">{worker.key}</div>
									</div>
								</div>
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
								{worker.job_key ? <JobCard jobKey={worker.job_key} /> : <span className="text-gray-400">No Job</span>}
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
								<Label
									status={worker.status}
									size="sm">
									{worker.status}
								</Label>
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
								<div className="text-right sm:text-left sm:min-w-[85px]">
									<TimeAgo datetime={worker.updated_at} />
								</div>
							</td>
							<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
								<div className="flex items-center gap-2">
									<Tooltip content="Delete">
										<Button
											variant="soft"
											hover="danger"
											size="sm"
											iconOnly
											onClick={(e) => {
												e.stopPropagation();
												handleDeleteWorker(worker);
											}}>
											<TrashIcon className="h-4 w-4" />
										</Button>
									</Tooltip>
									<Tooltip content="View">
										<Button
											variant="soft"
											size="sm"
											iconOnly
											onClick={(e) => {
												e.stopPropagation();
												navigate(`/instances/${instanceKey}/workers/${worker.key}/info`);
											}}>
											<EyeIcon className="h-4 w-4" />
										</Button>
									</Tooltip>
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>

			{/* Delete Confirmation Modal */}
			{workerToDelete && (
				<ConfirmModal
					isOpen={!!workerToDelete}
					onClose={handleCloseDeleteModal}
					onConfirm={handleConfirmDelete}
					title="Delete Worker"
					message={
						<>
							<p className="mb-4">Are you sure you want to delete this worker?</p>
							<ul className="list-disc list-inside space-y-1 mb-4 text-sm">
								<li>{workerToDelete.key}</li>
							</ul>
							<p className="font-semibold text-red-600 dark:text-red-400">This action cannot be undone!</p>
						</>
					}
					confirmText="Delete"
					variant="danger"
					isLoading={deleteWorkerMutation.isPending}
					loadingText="Deleting"
				/>
			)}

			{/* Nested Outlet for WorkerDetailModal */}
			<Outlet context={{ instance }} />
		</div>
	);
};

export default Workers;
