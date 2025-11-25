import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/utils/api";

type StatRow = {
	key: string;
	date: string;
	data: {
		jobs_recieved?: number;
		inputs_recieved?: number;
		outputs_requested?: number;
		outputs_completed?: number;
		outputs_failed?: number;
		notifications_requested?: number;
		[key: string]: number | undefined;
	};
};

type DateRange = "7d" | "30d" | "90d";

const DATE_RANGE_OPTIONS: { label: string; value: DateRange; days: number }[] = [
	{ label: "Last 7 days", value: "7d", days: 7 },
	{ label: "Last 30 days", value: "30d", days: 30 },
	{ label: "Last 90 days", value: "90d", days: 90 }
];

const Dashboard: React.FC = () => {
	const { authToken } = useAuth();
	const [dateRange, setDateRange] = useState<DateRange>("30d");
	const [stats, setStats] = useState<StatRow[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchStats = async () => {
			try {
				setIsLoading(true);
				setError(null);

				const option = DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)!;
				const until = new Date();
				const since = new Date();
				since.setDate(until.getDate() - (option.days - 1));

				const format = (d: Date) => d.toISOString().slice(0, 10);

				const res = await api.get("/stats", {
					params: {
						since_at: format(since),
						until_at: format(until)
					},
					headers: authToken
						? {
								Authorization: `Bearer ${authToken}`
							}
						: undefined
				});

				setStats((res.data?.data || []) as StatRow[]);
			} catch (err: any) {
				setError(err?.message || "Failed to load stats");
			} finally {
				setIsLoading(false);
			}
		};

		fetchStats();
	}, [dateRange, authToken]);

	const aggregates = useMemo(() => {
		return stats.reduce(
			(acc, row) => {
				acc.jobs_recieved += row.data.jobs_recieved || 0;
				acc.inputs_recieved += row.data.inputs_recieved || 0;
				acc.outputs_requested += row.data.outputs_requested || 0;
				acc.outputs_completed += row.data.outputs_completed || 0;
				acc.outputs_failed += row.data.outputs_failed || 0;
				acc.notifications_requested += row.data.notifications_requested || 0;
				return acc;
			},
			{
				jobs_recieved: 0,
				inputs_recieved: 0,
				outputs_requested: 0,
				outputs_completed: 0,
				outputs_failed: 0,
				notifications_requested: 0
			}
		);
	}, [stats]);

	const chartSeries = useMemo(() => {
		const dates = stats.map((row) => row.date);
		if (dates.length === 0) return null;

		const valuesRequested = stats.map((row) => row.data.outputs_requested || 0);
		const valuesCompleted = stats.map((row) => row.data.outputs_completed || 0);
		const valuesFailed = stats.map((row) => row.data.outputs_failed || 0);

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
			}
		};
	}, [stats]);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>

				<div className="flex items-center gap-2 text-sm">
					<label
						htmlFor="date-range"
						className="text-xs font-medium text-gray-400">
						Date range
					</label>
					<select
						id="date-range"
						value={dateRange}
						onChange={(e) => setDateRange(e.target.value as DateRange)}
						className="rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-100 shadow-sm focus:border-gray-400 focus:outline-none">
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

			{/* Top stat cards */}
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
					<div className="flex items-center justify-between text-xs text-gray-400">
						<span>Jobs</span>
						<span className="text-[11px] uppercase tracking-wide text-gray-500">received</span>
					</div>
					<div className="mt-3 flex items-baseline justify-between">
						<span className="text-2xl font-semibold text-gray-50">{aggregates.jobs_recieved}</span>
						<span className="text-xs text-gray-500">/ {aggregates.jobs_recieved}</span>
					</div>
				</div>

				<div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
					<div className="flex items-center justify-between text-xs text-gray-400">
						<span>Inputs</span>
						<span className="text-[11px] uppercase tracking-wide text-gray-500">received</span>
					</div>
					<div className="mt-3 flex items-baseline justify-between">
						<span className="text-2xl font-semibold text-gray-50">{aggregates.inputs_recieved}</span>
						<span className="text-xs text-gray-500">/ {aggregates.inputs_recieved}</span>
					</div>
				</div>

				<div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
					<div className="flex items-center justify-between text-xs text-gray-400">
						<span>Outputs</span>
						<span className="text-[11px] uppercase tracking-wide text-gray-500">requested / completed</span>
					</div>
					<div className="mt-3 flex items-baseline justify-between">
						<span className="text-2xl font-semibold text-gray-50">{aggregates.outputs_completed}</span>
						<span className="text-xs text-gray-500">
							{aggregates.outputs_completed} / {aggregates.outputs_requested}
						</span>
					</div>
				</div>

				<div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
					<div className="flex items-center justify-between text-xs text-gray-400">
						<span>Notifications</span>
						<span className="text-[11px] uppercase tracking-wide text-gray-500">requested</span>
					</div>
					<div className="mt-3 flex items-baseline justify-between">
						<span className="text-2xl font-semibold text-gray-50">{aggregates.notifications_requested}</span>
						<span className="text-xs text-gray-500">/ {aggregates.notifications_requested}</span>
					</div>
				</div>
			</div>

			{/* Outputs chart */}
			<div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
				<div className="mb-4 flex items-center justify-between gap-2">
					<div>
						<h2 className="text-sm font-medium text-gray-100">Outputs</h2>
						<p className="text-xs text-gray-500">Requested vs completed and failed</p>
					</div>
					<div className="flex items-center gap-3 text-[11px] text-gray-400">
						<div className="flex items-center gap-1">
							<span className="h-2 w-2 rounded-full bg-gray-500" />
							<span>requested</span>
						</div>
						<div className="flex items-center gap-1">
							<span className="h-2 w-2 rounded-full bg-emerald-500" />
							<span>completed</span>
						</div>
						<div className="flex items-center gap-1">
							<span className="h-2 w-2 rounded-full bg-red-500" />
							<span>failed</span>
						</div>
					</div>
				</div>

				{isLoading && <div className="flex h-48 items-center justify-center text-xs text-gray-500">Loading stats…</div>}

				{!isLoading && error && <div className="flex h-48 items-center justify-center text-xs text-red-400">{error}</div>}

				{!isLoading && !error && (!chartSeries || chartSeries.dates.length === 0) && (
					<div className="flex h-48 items-center justify-center text-xs text-gray-500">No data available for selected range.</div>
				)}

				{!isLoading && !error && chartSeries && chartSeries.dates.length > 0 && (
					<div className="w-full overflow-x-auto">
						<svg
							viewBox={`0 0 ${chartSeries.width} ${chartSeries.height}`}
							className="h-64 min-w-full text-gray-400">
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
											stroke="#1f2937"
											strokeWidth={0.5}
											strokeDasharray="2 2"
										/>
										<text
											x={chartSeries.paddingLeft - 6}
											y={y + 3}
											textAnchor="end"
											className="fill-gray-500 text-[9px]">
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
										className="fill-gray-500 text-[9px]">
										{d.slice(5)}
									</text>
								);
							})}

							{/* Lines */}
							<path
								d={chartSeries.paths.requested}
								fill="none"
								stroke="#6b7280"
								strokeWidth={1.6}
							/>
							<path
								d={chartSeries.paths.completed}
								fill="none"
								stroke="#22c55e"
								strokeWidth={1.8}
							/>
							<path
								d={chartSeries.paths.failed}
								fill="none"
								stroke="#ef4444"
								strokeWidth={1.4}
							/>
						</svg>
					</div>
				)}
			</div>
		</div>
	);
};

export default Dashboard;
