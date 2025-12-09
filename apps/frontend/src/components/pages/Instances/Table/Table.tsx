import { useMemo, useState, useEffect, Fragment } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable, getExpandedRowModel } from "@tanstack/react-table";
import { useNavigate } from "react-router-dom";
import { Instance } from "@/interfaces/instance";
import { TimeAgo, Tooltip, Button, Label, EmptyState, LoadingOverlay, ProgressBar } from "@/components";
import { ChevronDownIcon, ChevronRightIcon, EyeIcon } from "@heroicons/react/24/outline";
import { getInstanceName } from "@/utils/naming";
import { getCountryFromIP } from "@/utils";
import WorkersTable from "./Workers/Workers";

interface InstancesTableProps {
	data: Instance[];
	loading: boolean;
}

const columnHelper = createColumnHelper<Instance>();

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
				const ip = instance.specs?.ip_address;
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
					const ip = instance.specs?.ip_address;
					const countryData = ip ? countryCache[ip] : null;

					return (
						<div className="flex items-start gap-3">
							{/* Expand/Collapse Button */}
							{hasWorkers && (
								<Button
									variant="ghost"
									size="sm"
									iconOnly
									className="hidden sm:flex"
									onClick={(e) => {
										e.stopPropagation();
										const rowId = info.row.id;
										setCollapsed((prev) => ({
											...prev,
											[rowId]: !prev[rowId]
										}));
									}}>
									{!collapsed[info.row.id] ? (
										<ChevronDownIcon className="h-4 w-4 text-gray-500" />
									) : (
										<ChevronRightIcon className="h-4 w-4 text-gray-500" />
									)}
								</Button>
							)}

							{/* Instance Info Card */}
							<div className="flex-1 space-y-2 flex flex-col items-end sm:items-start">
								{/* Instance Name & Type Badge */}
								<div className="flex items-center gap-2">
									<span className="text-sm font-bold text-gray-900 dark:text-white">
										{getInstanceName(data, instance)}
									</span>
									<Label
										status={instance.type}
										size="sm">
										{instance.type}
									</Label>
								</div>

								{/* Instance Key */}
								<div className="flex items-center gap-1.5">
									<span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{instance.key}</span>
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
									{instance.specs?.hostname && (
										<div className="flex items-center gap-1">
											<span className="font-medium">Host:</span>
											<span>{instance.specs.hostname}</span>
										</div>
									)}
									{instance.specs?.os_platform && (
										<div className="flex items-center gap-1">
											<span className="font-medium">OS:</span>
											<span>{instance.specs.os_platform}</span>
										</div>
									)}
								</div>
							</div>
						</div>
					);
				}
			}),
			columnHelper.accessor("specs", {
				header: "CPU",
				cell: (info) => {
					const specs = info.getValue();
					if (!specs?.cpu_core_count || specs.cpu_usage_percent === undefined) {
						return <span className="text-gray-400 text-sm">N/A</span>;
					}

					const usage = specs.cpu_usage_percent;
					const cores = specs.cpu_core_count;

					return (
						<ProgressBar
							value={usage}
							subLabel={`${cores} cores`}
							className="max-w-75 sm:max-w-full"
						/>
					);
				}
			}),
			columnHelper.accessor("specs", {
				id: "memory",
				header: "Memory",
				cell: (info) => {
					const specs = info.getValue();
					if (!specs?.memory_total || specs.memory_usage_percent === undefined) {
						return <span className="text-gray-400 text-sm">N/A</span>;
					}

					const totalGB = specs.memory_total / 1024 ** 3;
					const usedGB = (specs.memory_total - specs.memory_free) / 1024 ** 3;
					const usagePercent = specs.memory_usage_percent;

					return (
						<ProgressBar
							value={usagePercent}
							subLabel={`${usedGB.toFixed(1)} / ${totalGB.toFixed(1)} GB`}
							className="max-w-75 sm:max-w-full"
						/>
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
							{status}
						</Label>
					);
				}
			}),
			columnHelper.accessor("restart_count", {
				header: "Restarts",
				cell: (info) => {
					const count = info.getValue();
					return <span className="text-sm text-gray-700 dark:text-gray-300">{count !== undefined ? count : 0}</span>;
				}
			}),
			columnHelper.accessor("updated_at", {
				header: "Updated At",
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
			/*
			columnHelper.accessor("created_at", {
				header: "Created At",
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
			*/
			columnHelper.display({
				id: "actions",
				header: "Actions",
				cell: (info) => {
					const instance = info.row.original;
					return (
						<div className="flex items-center justify-end sm:justify-start gap-2">
							<Tooltip content="View">
								<Button
									variant="soft"
									size="md"
									iconOnly
									onClick={(e) => {
										e.stopPropagation();
										navigate(`/instances/${instance.key}/info`);
									}}>
									<EyeIcon className="h-5 w-5" />
								</Button>
							</Tooltip>
						</div>
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

	return (
		<div className="bg-gray-50 dark:bg-neutral-800 shadow-md rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700">
			<div className="w-full relative">
				{/* Loading Overlay */}
				<LoadingOverlay show={loading} />

				<div className="overflow-x-auto">
					<table className="responsive-table min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
						<thead className="bg-gray-50 dark:bg-neutral-800">
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
						<tbody className="bg-white dark:bg-neutral-900 divide-y divide-gray-200 dark:divide-neutral-800">
							{table.getRowModel().rows.length === 0 ? (
								<EmptyState
									message="No instances found"
									colSpan={columns.length}
								/>
							) : (
								table.getRowModel().rows.map((row) => (
									<Fragment key={row.id}>
										{/* Main Instance Row */}
										<tr
											onClick={() => navigate(`/instances/${row.original.key}/info`)}
											className="group hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
											{row.getVisibleCells().map((cell) => (
												<td
													key={cell.id}
													data-label={cell.column.columnDef.header}
													className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
													{flexRender(cell.column.columnDef.cell, cell.getContext())}
												</td>
											))}
										</tr>

										{/* Expanded Workers Rows */}
										{!collapsed[row.id] && row.original.workers && row.original.workers.length > 0 && (
											<tr key={`${row.id}-workers`}>
												<td
													colSpan={8}
													data-no-label="true"
													className="relative px-6 py-0 bg-gray-50 dark:bg-neutral-900/50">
													<div className="absolute left-3 left-sm-8.75 top-5 bottom-5 rounded-sm border-4 border-gray-100 bg-gray-100 dark:border-neutral-700 dark:bg-neutral-700" />
													<div className="py-4 pl-2 pl-sm-10 pr-2">
														<WorkersTable workers={row.original.workers} />
													</div>
												</td>
											</tr>
										)}
									</Fragment>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};
export default InstancesTable;
