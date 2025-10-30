import { useState, useEffect } from "react";
import type { Job } from "@/interfaces/job";
import { useAuth } from "@/hooks/useAuth";

const Jobs: React.FC = () => {
	const { authToken } = useAuth();

	// states
	const [jobs, setJobs] = useState<Job[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// effects
	useEffect(() => {
		const fetchJobs = async () => {
			try {
				const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/jobs?token=${authToken}`);

				if (!response.ok) {
					throw new Error("Failed to fetch jobs");
				}

				const data = await response.json();
				setJobs(data);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to fetch jobs");
			} finally {
				setLoading(false);
			}
		};

		fetchJobs();
	}, []);

	// renders
	if (loading) {
		return (
			<div className="flex justify-center items-center h-64">
				<div className="animate-spin rounded-full h-10 w-10 border-2 border-b-white border-indigo-500"></div>
			</div>
		);
	}

	if (error) {
		return <div className="text-red-500 text-center py-4">{error}</div>;
	}

	return (
		<div className="table-advanced">
			<div className="table-advanced-header">
				<h3 className="text-lg font-medium leading-6">Jobs</h3>
			</div>
			<div className="flex flex-col">
				<div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
					<div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
						<div className="shadow overflow-hidden border-b border-gray-200 dark:border-gray-700 sm:rounded-lg">
							<table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
								<thead>
									<tr>
										<th scope="col">Key</th>
										<th scope="col">Status</th>
										<th scope="col">Service</th>
										<th scope="col">Started</th>
										<th scope="col">Completed</th>
										<th scope="col">Error</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
									{jobs.map((job) => (
										<tr key={job.key}>
											<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
												{job.key}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm">
												<span
													className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
														job.status === "COMPLETED"
															? "bg-green-100 text-green-800"
															: job.status === "FAILED"
																? "bg-red-100 text-red-800"
																: job.status === "RUNNING"
																	? "bg-blue-100 text-blue-800"
																	: "bg-gray-100 text-gray-800"
													}`}>
													{job.status}
												</span>
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
												{job.input.service}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
												{job.started_at ? new Date(job.started_at).toLocaleString() : "-"}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
												{job.completed_at ? new Date(job.completed_at).toLocaleString() : "-"}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm text-red-500">
												{job.error ? (
													<span title={job.error}>
														{(() => {
															try {
																const errorObj = JSON.parse(job.error);
																return errorObj.message;
															} catch {
																return job.error;
															}
														})()}
													</span>
												) : (
													"-"
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Jobs;
