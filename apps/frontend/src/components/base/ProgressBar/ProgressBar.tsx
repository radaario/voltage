import { clsx } from "@/utils";

interface ProgressBarProps {
	value: number;
	max?: number;
	label?: string;
	subLabel?: string;
	showPercentage?: boolean;
	size?: "sm" | "md" | "lg";
	className?: string;
}

const ProgressBar = ({ value, max = 100, label, subLabel, showPercentage = true, size = "md", className = "" }: ProgressBarProps) => {
	const percentage = Math.min((value / max) * 100, 100);

	const heightClasses = {
		sm: "h-1.5",
		md: "h-2",
		lg: "h-3"
	};

	const getColorClass = () => {
		if (percentage > 80) return "bg-red-500";
		if (percentage > 60) return "bg-yellow-500";
		return "bg-green-500";
	};

	return (
		<div className={clsx("space-y-1 min-w-35", className)}>
			<div className={`w-full bg-gray-200 dark:bg-neutral-700 rounded-full ${heightClasses[size]} overflow-hidden`}>
				<div
					className={`h-full rounded-full transition-all ${getColorClass()}`}
					style={{ width: `${percentage}%` }}
				/>
			</div>
			{(showPercentage || label || subLabel) && (
				<div className="flex items-center justify-between gap-2">
					{showPercentage && (
						<span className="text-sm font-medium text-gray-700 dark:text-gray-300">{percentage.toFixed(1)}%</span>
					)}
					{label && <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>}
					{subLabel && <span className="text-xs text-gray-500 dark:text-gray-400">{subLabel}</span>}
				</div>
			)}
		</div>
	);
};

export default ProgressBar;
