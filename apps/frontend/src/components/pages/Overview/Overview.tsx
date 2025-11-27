import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import { Page } from "@/components";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { ArrowDownTrayIcon, ArrowUpTrayIcon, BellIcon, RectangleStackIcon } from "@heroicons/react/24/outline";
import { NavLink } from "react-router-dom";

type StatRow = {
	key: string;
	date: string;
	data: {
		jobs_recieved_count?: number;
		jobs_retried_count?: number;
		jobs_failed_count?: number;
		jobs_completed_count?: number;

		inputs_recieved_count?: number;
		inputs_failed_count?: number;
		inputs_failed_duration?: number;
		inputs_completed_count?: number;
		inputs_completed_duration?: number;

		outputs_requested_count?: number;
		outputs_failed_count?: number;
		outputs_failed_duration?: number;
		outputs_completed_count?: number;
		outputs_completed_duration?: number;

		notifications_retried_count?: number;
		notifications_sent_count?: number;
		notifications_failed_count?: number;
		[key: string]: number | undefined;
	};
};

type DateRange = "7d" | "30d" | "90d" | "180d" | "1y";

const DATE_RANGE_OPTIONS: { label: string; value: DateRange; days: number }[] = [
	{ label: "Last 7 days", value: "7d", days: 7 },
	{ label: "Last 1 month", value: "30d", days: 30 },
	{ label: "Last 3 months", value: "90d", days: 90 },
	{ label: "Last 6 months", value: "180d", days: 180 },
	{ label: "Last 1 year", value: "1y", days: 365 }
];

const Overview: React.FC = () => {
	const { authToken } = useAuth();
	const [dateRange, setDateRange] = useState<DateRange>("30d");

	const option = DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)!;
	const until = new Date();
	const since = new Date();
	since.setDate(until.getDate() - (option.days - 1));
	const format = (d: Date) => d.toISOString().slice(0, 10);

	const {
		data: statsResponse,
		isLoading,
		error
	} = useQuery<ApiResponse<StatRow[]>>({
		queryKey: ["stats", dateRange, authToken],
		queryFn: () =>
			api.get<StatRow[]>("/stats", {
				token: authToken || "",
				since_at: format(since),
				until_at: format(until)
			}),
		enabled: !!authToken,
		refetchOnWindowFocus: true,
		refetchInterval: 30_000 // 30 saniyede bir otomatik refresh
	});

	const stats = statsResponse?.data || [];

	const aggregates = useMemo(() => {
		return stats.reduce(
			(acc, row) => {
				acc.jobs_recieved_count += row.data.jobs_recieved_count || 0;
				acc.jobs_retried_count += row.data.jobs_retried_count || 0;
				acc.jobs_failed_count += row.data.jobs_failed_count || 0;
				acc.jobs_completed_count += row.data.jobs_completed_count || 0;

				acc.inputs_recieved_count += row.data.inputs_recieved_count || 0;
				acc.inputs_failed_count += row.data.inputs_failed_count || 0;
				acc.inputs_failed_duration += row.data.inputs_failed_duration || 0;
				acc.inputs_completed_count += row.data.inputs_completed_count || 0;
				acc.inputs_completed_duration += row.data.inputs_completed_duration || 0;

				acc.outputs_requested_count += row.data.outputs_requested_count || 0;
				acc.outputs_failed_count += row.data.outputs_failed_count || 0;
				acc.outputs_failed_duration += row.data.outputs_failed_duration || 0;
				acc.outputs_completed_count += row.data.outputs_completed_count || 0;
				acc.outputs_completed_duration += row.data.outputs_completed_duration || 0;

				acc.notifications_retried_count += row.data.notifications_retried_count || 0;
				acc.notifications_sent_count += row.data.notifications_sent_count || 0;
				acc.notifications_failed_count += row.data.notifications_failed_count || 0;

				return acc;
			},
			{
				jobs_recieved_count: 0,
				jobs_retried_count: 0,
				jobs_failed_count: 0,
				jobs_completed_count: 0,

				inputs_recieved_count: 0,
				inputs_failed_count: 0,
				inputs_failed_duration: 0,
				inputs_completed_count: 0,
				inputs_completed_duration: 0,

				outputs_requested_count: 0,
				outputs_failed_count: 0,
				outputs_failed_duration: 0,
				outputs_completed_count: 0,
				outputs_completed_duration: 0,

				notifications_retried_count: 0,
				notifications_sent_count: 0,
				notifications_failed_count: 0
			}
		);
	}, [stats.length, stats]);

	const chartSeries = useMemo(() => {
		const dates = stats.map((row) => row.date);
		if (dates.length === 0) return null;

		const valuesRequested = stats.map((row) => row.data.outputs_requested_count || 0);
		const valuesCompleted = stats.map((row) => row.data.outputs_completed_count || 0);
		const valuesFailed = stats.map((row) => row.data.outputs_failed_count || 0);

		const maxVal = Math.max(1, ...valuesRequested, ...valuesCompleted, ...valuesFailed);

		const width = 800;
		const height = 220;
		const paddingLeft = 40;
		const paddingRight = 20;
		const paddingTop = 10;
		const paddingBottom = 30;
		const innerWidth = width - paddingLeft - paddingRight;
		const innerHeight = height - paddingTop - paddingBottom;

		const toX = (index: number) => {
			if (stats.length === 1) return paddingLeft + innerWidth / 2;
			return paddingLeft + (index / (stats.length - 1)) * innerWidth;
		};

		const toY = (value: number) => paddingTop + innerHeight - (value / maxVal) * innerHeight;

		const buildPath = (values: number[]) =>
			values
				.map((v, i) => {
					const x = toX(i);
					const y = toY(v);
					return `${i === 0 ? "M" : "L"}${x},${y}`;
				})
				.join(" ");

		// Build data points for tooltips
		const dataPoints = stats.map((row, i) => ({
			date: row.date,
			x: toX(i),
			requested: {
				value: row.data.outputs_requested_count || 0,
				y: toY(row.data.outputs_requested_count || 0)
			},
			completed: {
				value: row.data.outputs_completed_count || 0,
				y: toY(row.data.outputs_completed_count || 0)
			},
			failed: {
				value: row.data.outputs_failed_count || 0,
				y: toY(row.data.outputs_failed_count || 0)
			}
		}));

		return {
			width,
			height,
			paddingLeft,
			paddingRight,
			paddingTop,
			paddingBottom,
			innerWidth,
			innerHeight,
			dates,
			maxVal,
			paths: {
				requested: buildPath(valuesRequested),
				completed: buildPath(valuesCompleted),
				failed: buildPath(valuesFailed)
			},
			dataPoints
		};
	}, [stats.length, stats]);

	return (
		<Page>
			{/* Header */}
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-2xl font-bold text-gray-900 dark:text-white">Overview</h1>

				<div className="flex items-center gap-2">
					<label
						htmlFor="date-range"
						className="text-sm font-medium text-gray-700 dark:text-gray-300">
						Date range
					</label>
					<select
						id="date-range"
						value={dateRange}
						onChange={(e) => setDateRange(e.target.value as DateRange)}
						className="rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500">
						{DATE_RANGE_OPTIONS.map((option) => (
							<option
								key={option.value}
								value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</div>
			</div>

			{/* Loading State */}
			{isLoading && !statsResponse && (
				<div className="flex justify-center items-center h-64">
					<div className="animate-spin rounded-full h-10 w-10 border-2 border-b-gray-900 dark:border-b-white border-gray-300 dark:border-gray-600"></div>
				</div>
			)}

			{/* Error State */}
			{error && (
				<div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
					<p className="text-sm text-red-600 dark:text-red-400">
						{error instanceof Error ? error.message : "Failed to load statistics"}
					</p>
				</div>
			)}

			{/* Content */}
			{!isLoading && !error && (
				<>
					{/* Top stat cards */}
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{/* Jobs Card */}
						<NavLink
							to="/jobs"
							title="Go to Jobs"
							className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 shadow-sm transition-all hover:shadow-md hover:bg-neutral-100/50 dark:hover:bg-neutral-700/50">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="rounded-lg bg-gray-100 dark:bg-neutral-700 p-2">
										<RectangleStackIcon className="h-6 w-6 " />
									</div>
									<div>
										<p className="text-sm font-medium text-gray-600 dark:text-gray-400">Jobs</p>
										{/* <p className="text-xs text-gray-500 dark:text-gray-500">Received</p> */}
									</div>
								</div>
							</div>
							<div className="mt-2 flex items-baseline gap-2 text-gray-900 dark:text-white">
								<p className="text-3xl font-bold">{aggregates.jobs_completed_count.toLocaleString()}</p>
								{/* <p className="text-xs text-gray-500 dark:text-white">completed</p> */}
							</div>
							<div className="mt-2 flex items-baseline gap-2 text-xs text-gray-500 dark:text-white">
								<p>{aggregates.jobs_recieved_count.toLocaleString()} requested</p>
								{aggregates.jobs_failed_count > 0 && (
									<p className="text-red-600 dark:text-red-400">
										({aggregates.jobs_failed_count.toLocaleString()} failed)
									</p>
								)}
							</div>
						</NavLink>

						{/* Inputs Card */}
						<div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 shadow-sm transition-all hover:shadow-md">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="rounded-lg bg-gray-100 dark:bg-neutral-700 p-2">
										<ArrowDownTrayIcon className="h-6 w-6 " />
									</div>
									<div>
										<p className="text-sm font-medium text-gray-600 dark:text-gray-400">Inputs</p>
										{/* <p className="text-xs text-gray-500 dark:text-gray-500">Received</p> */}
									</div>
								</div>
							</div>

							<div className="mt-2 flex items-baseline gap-2 text-gray-900 dark:text-white">
								<p className="text-3xl font-bold">{aggregates.inputs_completed_count.toLocaleString()}</p>
								{/* <p className="text-xs text-gray-500 dark:text-white">completed</p> */}
							</div>
							<div className="mt-2 flex items-baseline gap-2 text-xs text-gray-500 dark:text-white">
								<p>{aggregates.inputs_recieved_count.toLocaleString()} requested</p>
								{aggregates.inputs_failed_count > 0 && (
									<p className="text-red-600 dark:text-red-400">
										({aggregates.inputs_failed_count.toLocaleString()} failed)
									</p>
								)}
							</div>
						</div>

						{/* Outputs Card */}
						<div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 shadow-sm transition-all hover:shadow-md">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="rounded-lg bg-gray-100 dark:bg-neutral-700 p-2">
										<ArrowUpTrayIcon className="h-6 w-6 " />
									</div>
									<div>
										<p className="text-sm font-medium text-gray-600 dark:text-gray-400">Outputs</p>
										{/* <p className="text-xs text-gray-500 dark:text-gray-500">Completed / Requested</p> */}
									</div>
								</div>
							</div>
							<div className="mt-2 flex items-baseline gap-2 text-gray-900 dark:text-white">
								<p className="text-3xl font-bold">{aggregates.outputs_completed_count.toLocaleString()}</p>
								{/* <p className="text-xs text-gray-500 dark:text-white">completed</p> */}
							</div>
							<div className="mt-2 flex items-baseline gap-2 text-xs text-gray-500 dark:text-white">
								<p>{aggregates.outputs_requested_count.toLocaleString()} requested</p>
								{aggregates.outputs_failed_count > 0 && (
									<p className="text-red-600 dark:text-red-400">
										({aggregates.outputs_failed_count.toLocaleString()} failed)
									</p>
								)}
							</div>
						</div>

						{/* Notifications Card */}
						<NavLink
							to="/notifications"
							title="Go to Notifications"
							className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 shadow-sm transition-all hover:shadow-md hover:bg-neutral-100/50 dark:hover:bg-neutral-700/50">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="rounded-lg bg-gray-100 dark:bg-neutral-700 p-2">
										<BellIcon className="h-6 w-6" />
									</div>
									<div>
										<p className="text-sm font-medium text-gray-600 dark:text-gray-400">Notifications</p>
										{/* <p className="text-xs text-gray-500 dark:text-gray-500">Requested</p> */}
									</div>
								</div>
							</div>
							<div className="mt-2 flex items-baseline gap-2 text-gray-900 dark:text-white">
								<p className="text-3xl font-bold">{aggregates.notifications_sent_count.toLocaleString()}</p>
								{/* <p className="text-xs text-gray-500 dark:text-white">completed</p> */}
							</div>
							<div className="mt-2 flex items-baseline gap-2 text-xs text-gray-500 dark:text-white">
								<p>
									{(aggregates.notifications_sent_count + aggregates.notifications_failed_count).toLocaleString()}{" "}
									requested
								</p>
								{aggregates.notifications_failed_count > 0 && (
									<p className="text-red-600 dark:text-red-400">
										({aggregates.notifications_failed_count.toLocaleString()} failed)
									</p>
								)}
							</div>
						</NavLink>
					</div>

					{/* Outputs chart */}
					<div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6 shadow-sm">
						<div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
							<div>
								<h2 className="text-lg font-semibold text-gray-900 dark:text-white">Outputs</h2>
								{/* <p className="text-sm text-gray-600 dark:text-gray-400">Requested, completed and failed outputs</p> */}
							</div>
							<div className="flex items-center gap-4 text-xs">
								<div className="flex items-center gap-1.5">
									<span className="h-3 w-3 rounded-full bg-gray-500 dark:bg-gray-400" />
									<span className="text-gray-700 dark:text-gray-300">Requested</span>
								</div>
								<div className="flex items-center gap-1.5">
									<span className="h-3 w-3 rounded-full bg-emerald-500" />
									<span className="text-gray-700 dark:text-gray-300">Completed</span>
								</div>
								<div className="flex items-center gap-1.5">
									<span className="h-3 w-3 rounded-full bg-red-500" />
									<span className="text-gray-700 dark:text-gray-300">Failed</span>
								</div>
							</div>
						</div>

						{(!chartSeries || chartSeries.dates.length === 0) && (
							<div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 dark:bg-neutral-900/50">
								<p className="text-sm text-gray-500 dark:text-gray-400">No data available for selected range</p>
							</div>
						)}

						{chartSeries && chartSeries.dates.length > 0 && (
							<TooltipPrimitive.Provider delayDuration={100}>
								<div className="w-full overflow-x-auto">
									<svg
										viewBox={`0 0 ${chartSeries.width} ${chartSeries.height}`}
										className="h-64 min-w-full">
										{/* Y axis grid */}
										{[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
											const y = chartSeries.paddingTop + chartSeries.innerHeight - ratio * chartSeries.innerHeight;
											const value = Math.round(chartSeries.maxVal * ratio);
											return (
												<g key={idx}>
													<line
														x1={chartSeries.paddingLeft}
														y1={y}
														x2={chartSeries.width - chartSeries.paddingRight}
														y2={y}
														className="stroke-gray-200 dark:stroke-neutral-700"
														strokeWidth={0.5}
														strokeDasharray="2 2"
													/>
													<text
														x={chartSeries.paddingLeft - 6}
														y={y + 3}
														textAnchor="end"
														className="fill-gray-500 dark:fill-gray-400 text-[9px]">
														{value}
													</text>
												</g>
											);
										})}

										{/* X axis labels */}
										{chartSeries.dates.map((d, index) => {
											const x =
												chartSeries.dates.length === 1
													? chartSeries.paddingLeft + chartSeries.innerWidth / 2
													: chartSeries.paddingLeft +
														(index / (chartSeries.dates.length - 1)) * chartSeries.innerWidth;
											return (
												<text
													key={d}
													x={x}
													y={chartSeries.height - chartSeries.paddingBottom + 14}
													textAnchor="middle"
													className="fill-gray-500 dark:fill-gray-400 text-[9px]">
													{d.slice(5)}
												</text>
											);
										})}

										{/* Lines with invisible hover overlays */}
										<g>
											{/* Requested line with tooltip */}
											<TooltipPrimitive.Root>
												<TooltipPrimitive.Trigger asChild>
													<path
														d={chartSeries.paths.requested}
														fill="none"
														className="stroke-gray-500 dark:stroke-gray-400 hover:stroke-gray-700 dark:hover:stroke-gray-200 cursor-pointer transition-colors"
														strokeWidth={8}
														opacity={0}
														pointerEvents="stroke"
													/>
												</TooltipPrimitive.Trigger>
												<TooltipPrimitive.Portal>
													<TooltipPrimitive.Content
														side="top"
														sideOffset={5}
														className="z-50 overflow-hidden rounded-md bg-gray-900 dark:bg-neutral-700 px-3 py-2 text-xs shadow-md animate-in fade-in-0 zoom-in-95">
														<div className="space-y-1">
															<div className="font-semibold text-white">Requested Outputs</div>
															<div className="text-gray-300">
																Total:{" "}
																<span className="font-medium text-white">
																	{aggregates.outputs_requested_count}
																</span>
															</div>
														</div>
														<TooltipPrimitive.Arrow className="fill-gray-900 dark:fill-neutral-700" />
													</TooltipPrimitive.Content>
												</TooltipPrimitive.Portal>
											</TooltipPrimitive.Root>

											{/* Completed line with tooltip */}
											<TooltipPrimitive.Root>
												<TooltipPrimitive.Trigger asChild>
													<path
														d={chartSeries.paths.completed}
														fill="none"
														className="stroke-emerald-500 hover:stroke-emerald-400 cursor-pointer transition-colors"
														strokeWidth={8}
														opacity={0}
														pointerEvents="stroke"
													/>
												</TooltipPrimitive.Trigger>
												<TooltipPrimitive.Portal>
													<TooltipPrimitive.Content
														side="top"
														sideOffset={5}
														className="z-50 overflow-hidden rounded-md bg-gray-900 dark:bg-neutral-700 px-3 py-2 text-xs shadow-md animate-in fade-in-0 zoom-in-95">
														<div className="space-y-1">
															<div className="font-semibold text-white">Completed Outputs</div>
															<div className="text-gray-300">
																Total:{" "}
																<span className="font-medium text-emerald-400">
																	{aggregates.outputs_completed_count}
																</span>
															</div>
														</div>
														<TooltipPrimitive.Arrow className="fill-gray-900 dark:fill-neutral-700" />
													</TooltipPrimitive.Content>
												</TooltipPrimitive.Portal>
											</TooltipPrimitive.Root>

											{/* Failed line with tooltip */}
											<TooltipPrimitive.Root>
												<TooltipPrimitive.Trigger asChild>
													<path
														d={chartSeries.paths.failed}
														fill="none"
														className="stroke-red-500 hover:stroke-red-400 cursor-pointer transition-colors"
														strokeWidth={8}
														opacity={0}
														pointerEvents="stroke"
													/>
												</TooltipPrimitive.Trigger>
												<TooltipPrimitive.Portal>
													<TooltipPrimitive.Content
														side="top"
														sideOffset={5}
														className="z-50 overflow-hidden rounded-md bg-gray-900 dark:bg-neutral-700 px-3 py-2 text-xs shadow-md animate-in fade-in-0 zoom-in-95">
														<div className="space-y-1">
															<div className="font-semibold text-white">Failed Outputs</div>
															<div className="text-gray-300">
																Total:{" "}
																<span className="font-medium text-red-400">
																	{aggregates.outputs_failed_count}
																</span>
															</div>
														</div>
														<TooltipPrimitive.Arrow className="fill-gray-900 dark:fill-neutral-700" />
													</TooltipPrimitive.Content>
												</TooltipPrimitive.Portal>
											</TooltipPrimitive.Root>
										</g>

										{/* Visible lines */}
										<path
											d={chartSeries.paths.requested}
											fill="none"
											className="stroke-gray-500 dark:stroke-gray-400 pointer-events-none"
											strokeWidth={1.6}
										/>
										<path
											d={chartSeries.paths.completed}
											fill="none"
											className="stroke-emerald-500 pointer-events-none"
											strokeWidth={1.8}
										/>
										<path
											d={chartSeries.paths.failed}
											fill="none"
											className="stroke-red-500 pointer-events-none"
											strokeWidth={1.4}
										/>

										{/* Interactive data points with tooltips */}
										{chartSeries.dataPoints.map((point, i) => (
											<g key={`point-${i}`}>
												{/* Requested point */}
												<TooltipPrimitive.Root>
													<TooltipPrimitive.Trigger asChild>
														<circle
															cx={point.x}
															cy={point.requested.y}
															r="4"
															className="fill-gray-500 dark:fill-gray-400 cursor-pointer hover:r-6 transition-all stroke-white dark:stroke-neutral-800"
															strokeWidth="2"
														/>
													</TooltipPrimitive.Trigger>
													<TooltipPrimitive.Portal>
														<TooltipPrimitive.Content
															side="top"
															sideOffset={5}
															className="z-50 overflow-hidden rounded-md bg-gray-900 dark:bg-neutral-700 px-3 py-2 text-xs shadow-md animate-in fade-in-0 zoom-in-95">
															<div className="space-y-0.5">
																<div className="font-semibold text-white">{point.date}</div>
																<div className="text-gray-300">
																	Requested:{" "}
																	<span className="font-medium text-white">{point.requested.value}</span>
																</div>
															</div>
															<TooltipPrimitive.Arrow className="fill-gray-900 dark:fill-neutral-700" />
														</TooltipPrimitive.Content>
													</TooltipPrimitive.Portal>
												</TooltipPrimitive.Root>

												{/* Completed point */}
												<TooltipPrimitive.Root>
													<TooltipPrimitive.Trigger asChild>
														<circle
															cx={point.x}
															cy={point.completed.y}
															r="4"
															className="fill-emerald-500 cursor-pointer hover:r-6 transition-all stroke-white dark:stroke-neutral-800"
															strokeWidth="2"
														/>
													</TooltipPrimitive.Trigger>
													<TooltipPrimitive.Portal>
														<TooltipPrimitive.Content
															side="top"
															sideOffset={5}
															className="z-50 overflow-hidden rounded-md bg-gray-900 dark:bg-neutral-700 px-3 py-2 text-xs shadow-md animate-in fade-in-0 zoom-in-95">
															<div className="space-y-0.5">
																<div className="font-semibold text-white">{point.date}</div>
																<div className="text-gray-300">
																	Completed:{" "}
																	<span className="font-medium text-emerald-400">
																		{point.completed.value}
																	</span>
																</div>
															</div>
															<TooltipPrimitive.Arrow className="fill-gray-900 dark:fill-neutral-700" />
														</TooltipPrimitive.Content>
													</TooltipPrimitive.Portal>
												</TooltipPrimitive.Root>

												{/* Failed point */}
												{point.failed.value > 0 && (
													<TooltipPrimitive.Root>
														<TooltipPrimitive.Trigger asChild>
															<circle
																cx={point.x}
																cy={point.failed.y}
																r="4"
																className="fill-red-500 cursor-pointer hover:r-6 transition-all stroke-white dark:stroke-neutral-800"
																strokeWidth="2"
															/>
														</TooltipPrimitive.Trigger>
														<TooltipPrimitive.Portal>
															<TooltipPrimitive.Content
																side="top"
																sideOffset={5}
																className="z-50 overflow-hidden rounded-md bg-gray-900 dark:bg-neutral-700 px-3 py-2 text-xs shadow-md animate-in fade-in-0 zoom-in-95">
																<div className="space-y-0.5">
																	<div className="font-semibold text-white">{point.date}</div>
																	<div className="text-gray-300">
																		Failed:{" "}
																		<span className="font-medium text-red-400">
																			{point.failed.value}
																		</span>
																	</div>
																</div>
																<TooltipPrimitive.Arrow className="fill-gray-900 dark:fill-neutral-700" />
															</TooltipPrimitive.Content>
														</TooltipPrimitive.Portal>
													</TooltipPrimitive.Root>
												)}
											</g>
										))}
									</svg>
								</div>
							</TooltipPrimitive.Provider>
						)}
					</div>
				</>
			)}
		</Page>
	);
};

export default Overview;
