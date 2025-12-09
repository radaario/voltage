import React, { useMemo } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

type StatRow = {
	key: string;
	date: string;
	data: {
		outputs_requested_count?: number;
		outputs_failed_count?: number;
		outputs_completed_count?: number;
		[key: string]: number | undefined;
	};
};

interface OutputsChartProps {
	stats: StatRow[];
	aggregates: {
		outputs_requested_count: number;
		outputs_completed_count: number;
		outputs_failed_count: number;
	};
}

const OutputsChart: React.FC<OutputsChartProps> = ({ stats, aggregates }) => {
	const chartSeries = useMemo(() => {
		const dates = stats.map((row) => row.date);
		if (dates.length === 0) return null;

		const valuesRequested = stats.map((row) => row.data.outputs_requested_count || 0);
		const valuesCompleted = stats.map((row) => row.data.outputs_completed_count || 0);
		const valuesFailed = stats.map((row) => row.data.outputs_failed_count || 0);

		const maxVal = Math.max(1, ...valuesRequested, ...valuesCompleted, ...valuesFailed);

		const width = 1000; // viewBox base width, will scale with container
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
	}, [stats]);

	return (
		<div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-6 shadow-sm">
			<div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
				<div>
					<h2 className="text-lg font-semibold text-gray-900 dark:text-white">Outputs</h2>
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
							className="w-full h-64"
							preserveAspectRatio="none">
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
										: chartSeries.paddingLeft + (index / (chartSeries.dates.length - 1)) * chartSeries.innerWidth;
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
													<span className="font-medium text-white">{aggregates.outputs_requested_count}</span>
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
													<span className="font-medium text-red-400">{aggregates.outputs_failed_count}</span>
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
														Requested: <span className="font-medium text-white">{point.requested.value}</span>
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
														<span className="font-medium text-emerald-400">{point.completed.value}</span>
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
															Failed: <span className="font-medium text-red-400">{point.failed.value}</span>
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
	);
};

export default OutputsChart;
