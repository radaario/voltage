import { useMemo, useState, useEffect, Fragment } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable, getExpandedRowModel } from "@tanstack/react-table";
import { useNavigate } from "react-router-dom";
import { Instance } from "@/interfaces/instance";
import TimeAgo from "timeago-react";
import { ChevronDownIcon, ChevronRightIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

interface InstancesTableProps {
	data: Instance[];
	loading: boolean;
}

const columnHelper = createColumnHelper<Instance>();

// Helper function to get country from IP
const getCountryFromIP = async (ip: string): Promise<{ country: string; countryCode: string } | null> => {
	try {
		const response = await fetch(`http://ip-api.com/json/${ip}`);
		const data = await response.json();
		if (data.status === "success") {
			return {
				country: data.country,
				countryCode: data.countryCode
			};
		}
		return null;
	} catch (error) {
		console.error("Failed to fetch country from IP:", error);
		return null;
	}
};

const InstancesTable = ({ data, loading }: InstancesTableProps) => {
	const navigate = useNavigate();
	const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
	const [countryCache, setCountryCache] = useState<Record<string, { country: string; countryCode: string } | null>>({});

	// Fetch country data for all IPs
	useEffect(() => {
		const fetchCountries = async () => {
			const newCache: Record<string, { country: string; countryCode: string } | null> = { ...countryCache };
			let hasNewData = false;

			for (const instance of data) {
				const ip = instance.system?.ip_address;
				if (ip && !countryCache[ip]) {
					const countryData = await getCountryFromIP(ip);
					newCache[ip] = countryData;
					hasNewData = true;
				}
			}

			if (hasNewData) {
				setCountryCache(newCache);
			}
		};

		if (data.length > 0) {
			fetchCountries();
		}
	}, [data]);

	const columns = useMemo(
		() => [
			columnHelper.accessor("key", {
				header: "Instance",
				cell: (info) => {
					const instance = info.row.original;
					const hasWorkers = instance.workers && instance.workers.length > 0;
					const ip = instance.system?.ip_address;
					const countryData = ip ? countryCache[ip] : null;

					return (
						<div className="flex items-start gap-3">
							{/* Expand/Collapse Button */}
							{hasWorkers && (
								<button
									onClick={() => {
										const rowId = info.row.id;
										setCollapsed((prev) => ({
											...prev,
											[rowId]: !prev[rowId]
										}));
									}}
									className="mt-1 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
									{!collapsed[info.row.id] ? (
										<ChevronDownIcon className="h-4 w-4 text-gray-500" />
									) : (
										<ChevronRightIcon className="h-4 w-4 text-gray-500" />
									)}
								</button>
							)}

							{/* Instance Info Card */}
							<div className="flex-1 space-y-2">
								{/* Instance Key & Type */}
								<div className="flex items-center gap-2">
									<span className="font-mono text-sm text-gray-900 dark:text-white font-medium">{instance.key}</span>
									{instance.type && (
										<span
											className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
												instance.type === "MASTER"
													? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800"
													: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
											}`}>
											{instance.type}
										</span>
									)}
								</div>

								{/* System Info Row */}
								<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
									{/* IP Address & Country */}
									{ip && (
										<div className="flex items-center gap-1.5">
											{countryData?.countryCode && (
												<img
													src={`https://flagcdn.com/w20/${countryData.countryCode.toLowerCase()}.png`}
													alt={countryData.country}
													title={countryData.country}
													className="w-4 h-auto rounded shadow-sm"
												/>
											)}
											<span className="font-mono text-gray-700 dark:text-gray-300">{ip}</span>
										</div>
									)}
									{instance.system?.hostname && (
										<div className="flex items-center gap-1">
											<span className="font-medium">Host:</span>
											<span>{instance.system.hostname}</span>
										</div>
									)}
									{instance.system?.os_platform && (
										<div className="flex items-center gap-1">
											<span className="font-medium">OS:</span>
											<span>{instance.system.os_platform}</span>
										</div>
									)}
								</div>
							</div>
						</div>
					);
				}
			}),
			columnHelper.accessor("system", {
				header: "CPU",
				cell: (info) => {
					const system = info.getValue();
					if (!system?.cpu_core_count || system.cpu_usage_percent === undefined) {
						return <span className="text-gray-400 text-sm">N/A</span>;
					}

					const usage = system.cpu_usage_percent;
					const cores = system.cpu_core_count;

					return (
						<div className="space-y-1">
							<div className="w-full bg-gray-200 dark:bg-neutral-700 rounded-full h-2 overflow-hidden">
								<div
									className={`h-full rounded-full transition-all ${
										usage > 80 ? "bg-red-500" : usage > 60 ? "bg-yellow-500" : "bg-green-500"
									}`}
									style={{ width: `${Math.min(usage, 100)}%` }}
								/>
							</div>
							<div className="flex items-center justify-between gap-2">
								<span className="text-sm font-medium text-gray-700 dark:text-gray-300">{usage.toFixed(1)}%</span>
								<span className="text-xs text-gray-500 dark:text-gray-400">{cores} cores</span>
							</div>
						</div>
					);
				}
			}),
			columnHelper.accessor("system", {
				id: "memory",
				header: "Memory",
				cell: (info) => {
					const system = info.getValue();
					if (!system?.memory_total || system.memory_usage_percent === undefined) {
						return <span className="text-gray-400 text-sm">N/A</span>;
					}

					const totalGB = system.memory_total / 1024 ** 3;
					const usedGB = (system.memory_total - system.memory_free) / 1024 ** 3;
					const usagePercent = system.memory_usage_percent;

					return (
						<div className="space-y-1">
							<div className="w-full bg-gray-200 dark:bg-neutral-700 rounded-full h-2 overflow-hidden">
								<div
									className={`h-full rounded-full transition-all ${
										usagePercent > 80 ? "bg-red-500" : usagePercent > 60 ? "bg-yellow-500" : "bg-green-500"
									}`}
									style={{ width: `${Math.min(usagePercent, 100)}%` }}
								/>
							</div>
							<div className="flex items-center justify-between gap-2">
								<span className="text-sm font-medium text-gray-700 dark:text-gray-300">{usagePercent.toFixed(1)}%</span>
								<span className="text-xs text-gray-500 dark:text-gray-400">
									{usedGB.toFixed(1)} / {totalGB.toFixed(1)} GB
								</span>
							</div>
						</div>
					);
				}
			}),
			columnHelper.accessor("status", {
				header: "Status",
				cell: (info) => {
					const status = info.getValue();
					let colorClass =
						"bg-gray-100 text-gray-800 border-gray-300 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-700";

					if (status === "ACTIVE" || status === "ONLINE" || status === "RUNNING") {
						colorClass =
							"bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800";
					} else if (status === "INACTIVE" || status === "OFFLINE" || status === "STOPPED" || status === "EXITED") {
						colorClass = "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
					} else if (status === "IDLE") {
						colorClass =
							"bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800";
					}

					return (
						<span className={`inline-flex items-center px-3 py-1 rounded border text-sm font-medium ${colorClass}`}>
							{status}
						</span>
					);
				}
			}),
			columnHelper.accessor("updated_at", {
				header: "Updated",
				cell: (info) => {
					const date = info.getValue();
					return (
						<TimeAgo
							datetime={date}
							className="text-sm text-gray-500 dark:text-gray-400"
						/>
					);
				}
			}),
			columnHelper.accessor("created_at", {
				header: "Created",
				cell: (info) => {
					const date = info.getValue();
					return (
						<TimeAgo
							datetime={date}
							className="text-sm text-gray-500 dark:text-gray-400"
						/>
					);
				}
			})
		],
		[countryCache, collapsed]
	);

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getExpandedRowModel: getExpandedRowModel()
	});

	if (loading && data.length === 0) {
		return (
			<div className="flex justify-center items-center py-12">
				<div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
			</div>
		);
	}

	if (!data || data.length === 0) {
		return (
			<div className="text-center py-12">
				<p className="text-gray-500 dark:text-gray-400">No instances found</p>
			</div>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
				<thead className="bg-gray-50 dark:bg-neutral-900">
					{table.getHeaderGroups().map((headerGroup) => (
						<tr key={headerGroup.id}>
							{headerGroup.headers.map((header) => (
								<th
									key={header.id}
									className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
								</th>
							))}
						</tr>
					))}
				</thead>
				<tbody className="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
					{table.getRowModel().rows.map((row) => (
						<Fragment key={row.id}>
							{/* Main Instance Row */}
							<tr className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
								{row.getVisibleCells().map((cell) => (
									<td
										key={cell.id}
										className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>

							{/* Expanded Workers Rows */}
							{!collapsed[row.id] && row.original.workers && row.original.workers.length > 0 && (
								<tr key={`${row.id}-workers`}>
									<td
										colSpan={6}
										className="px-6 py-0 bg-gray-50 dark:bg-neutral-900/50">
										<div className="py-3 pl-12">
											<div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
												Workers
											</div>
											<div className="space-y-1">
												{row.original.workers.map((worker, idx) => (
													<div
														key={worker.key}
														className="flex items-center gap-4 py-2 px-3 bg-white dark:bg-neutral-800 rounded border border-gray-200 dark:border-neutral-700">
														<span className="text-xs text-gray-700 dark:text-gray-300 font-semibold -mr-2">
															{idx + 1}.
														</span>
														<span className="font-mono text-xs text-gray-600 dark:text-gray-400 flex-1">
															{worker.key}
														</span>
														<span
															className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
																worker.status === "RUNNING"
																	? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
																	: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
															}`}>
															{worker.status}
														</span>
														{worker.pid && (
															<span className="text-xs text-gray-500 dark:text-gray-400">
																PID: {worker.pid}
															</span>
														)}
														{worker.job_key && (
															<button
																onClick={() => navigate(`/jobs/${worker.job_key}/job`)}
																className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 border border-gray-300 dark:border-neutral-600 rounded transition-colors">
																<span>Job'a Git</span>
																<ArrowRightIcon className="h-3 w-3" />
															</button>
														)}
													</div>
												))}
											</div>
										</div>
									</td>
								</tr>
							)}
						</Fragment>
					))}
				</tbody>
			</table>
		</div>
	);
};

export default InstancesTable;
