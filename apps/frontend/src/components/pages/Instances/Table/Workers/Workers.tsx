import { useMemo } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useNavigate } from "react-router-dom";
import { Worker } from "@/interfaces/instance";
import { JobCard, TimeAgo, Tooltip, Button, Label } from "@/components";
import { EyeIcon } from "@heroicons/react/24/outline";
import { getWorkerName } from "@/utils/naming";

interface WorkersTableProps {
	workers: Worker[];
}

const columnHelper = createColumnHelper<Worker>();

const WorkersTable = ({ workers }: WorkersTableProps) => {
	const navigate = useNavigate();

	const columns = useMemo(
		() => [
			columnHelper.accessor("key", {
				header: "Worker",
				cell: (info) => {
					const worker = info.row.original;
					return (
						<div className="space-y-1 text-right sm:text-left">
							<div className="text-sm text-gray-900 dark:text-white font-bold">{getWorkerName(workers, worker)}</div>
							<div className="font-mono text-xs text-gray-500 dark:text-gray-400">{worker.key}</div>
						</div>
					);
				}
			}),
			columnHelper.accessor("job_key", {
				header: "Job",
				cell: (info) => {
					const jobKey = info.getValue();
					return jobKey ? <JobCard jobKey={jobKey} /> : <span className="text-xs text-gray-400">No Job</span>;
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
			columnHelper.display({
				id: "actions",
				header: "Actions",
				cell: (info) => {
					const worker = info.row.original;
					return (
						<Tooltip content="View">
							<Button
								variant="soft"
								size="sm"
								iconOnly
								onClick={(e) => {
									e.stopPropagation();
									navigate(`/instances/workers/${worker.key}/info`);
								}}>
								<EyeIcon className="h-4 w-4" />
							</Button>
						</Tooltip>
					);
				}
			})
		],
		[workers]
	);

	const table = useReactTable({
		data: workers,
		columns,
		getCoreRowModel: getCoreRowModel()
	});

	return (
		<div className="overflow-x-auto border border-gray-200 dark:border-neutral-700 rounded-lg">
			<table className="responsive-table min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
				<thead className="bg-gray-100 dark:bg-neutral-900/80">
					{table.getHeaderGroups().map((headerGroup) => (
						<tr key={headerGroup.id}>
							{headerGroup.headers.map((header) => (
								<th
									key={header.id}
									className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
								</th>
							))}
						</tr>
					))}
				</thead>
				<tbody className="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
					{table.getRowModel().rows.map((row) => (
						<tr
							key={row.id}
							onClick={() => navigate(`/instances/workers/${row.original.key}/info`)}
							className="hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors cursor-pointer">
							{row.getVisibleCells().map((cell) => (
								<td
									key={cell.id}
									data-label={cell.column.columnDef.header}
									className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

export default WorkersTable;
