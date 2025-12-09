import { clsx } from "@/utils";
import React from "react";
import {
	CheckIcon,
	XMarkIcon,
	ClockIcon,
	ArrowPathIcon,
	ArrowUpTrayIcon,
	ArrowDownTrayIcon,
	ArrowDownOnSquareIcon,
	ChartBarIcon
} from "@heroicons/react/24/outline";
import type { LabelProps, LabelVariant } from "@/types";

const PROGRESS_ALLOWED_STATUSES = [
	"STARTED",
	"DOWNLOADING",
	"DOWNLOADED",
	"ANALYZING",
	"ANALYZED",
	"PROCESSING",
	"PROCESSED",
	"UPLOADING",
	"UPLOADED"
];

const Label: React.FC<LabelProps> = ({
	children,
	size = "md",
	variant = "neutral",
	status,
	statusColor = true,
	progress,
	hidden = "",
	className = "",
	icon = true
}) => {
	// Determine variant from status if provided
	const finalVariant = status && statusColor ? getVariantFromStatus(status) : variant;
	const upperStatus = status ? status.toUpperCase() : "";

	const hasProgress = typeof progress === "number" && PROGRESS_ALLOWED_STATUSES.includes(upperStatus) && progress > 0 && progress < 100;

	// Size classes
	const sizeClasses = {
		sm: "px-2 py-0.5 text-xs",
		md: "px-2.5 py-1 text-xs",
		lg: "px-3 py-1.5 text-sm"
	};

	// Variant color classes
	const variantClasses = {
		success: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
		error: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
		deleted: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
		warning: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
		info: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
		gray: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-neutral-900/30 dark:text-neutral-400 dark:border-neutral-700",
		neutral: "bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-900/30 dark:text-neutral-400 dark:border-neutral-700",
		blue: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
		purple: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
		green: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
		red: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
		yellow: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"
	};

	// Progress bar darker overlay colors
	const progressBarClasses = {
		success: "bg-green-200 dark:bg-green-700",
		error: "bg-red-200 dark:bg-red-700",
		deleted: "bg-red-200 dark:bg-red-700",
		warning: "bg-yellow-200 dark:bg-yellow-700",
		info: "bg-blue-200 dark:bg-blue-700",
		gray: "bg-gray-200 dark:bg-gray-700",
		neutral: "bg-neutral-200 dark:bg-neutral-700",
		blue: "bg-blue-200 dark:bg-blue-700",
		purple: "bg-purple-200 dark:bg-purple-700",
		green: "bg-green-200 dark:bg-green-700",
		red: "bg-red-200 dark:bg-red-700",
		yellow: "bg-yellow-200 dark:bg-yellow-700"
	};

	// Get icon component based on status
	const getStatusIcon = () => {
		if (!icon || !status) return null;

		const iconClass = "w-4 h-4";

		switch (upperStatus) {
			case "RECEIVED":
				return <ArrowDownOnSquareIcon className={iconClass} />;
			case "IDLE":
			case "PENDING":
			case "QUEUED":
				return <ClockIcon className={iconClass} />;
			case "RETRYING":
				return <ArrowPathIcon className={`${iconClass} animate-spin [animation-duration:2s]`} />;
			case "SUCCESS":
			case "SUCCESSFUL":
			case "ONLINE":
			case "COMPLETED":
				return <CheckIcon className={iconClass} />;
			case "OFFLINE":
			case "SKIPPED":
			case "ERROR":
			case "CANCELLED":
			case "DELETED":
			case "FAILED":
			case "TIMEOUT":
			case "TERMINATED":
				return <XMarkIcon className={iconClass} />;
			case "STARTED":
			case "BUSY":
				return <ArrowPathIcon className={`${iconClass} animate-spin`} />;
			case "DOWNLOADING":
			case "DOWNLOADED":
				return <ArrowDownTrayIcon className={iconClass} />;
			case "ANALYZING":
			case "ANALYZED":
				return <ChartBarIcon className={iconClass} />;
			case "PROCESSING":
			case "PROCESSED":
				return <ChartBarIcon className={iconClass} />;
			case "UPLOADING":
			case "UPLOADED":
				return <ArrowUpTrayIcon className={iconClass} />;
		}
	};

	const StatusIcon = getStatusIcon();

	return (
		<span
			className={clsx(
				`items-center font-semibold rounded border relative overflow-hidden`,
				{
					"inline-flex": hidden === "",
					[`hidden ${hidden}:flex`]: hidden !== ""
				},
				StatusIcon ? "gap-1" : "",
				sizeClasses[size],
				variantClasses[finalVariant],
				className
			)}>
			{/* Progress Bar Overlay */}
			{hasProgress && (
				<>
					<div
						className={`absolute bottom-0 left-0 h-full transition-all duration-300 ${progressBarClasses[finalVariant]}`}
						style={{ width: `${progress}%` }}
					/>
					{/* Shimmer Effect */}
					<div
						className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/5"
						style={{ animation: "shimmer 1s ease-in-out infinite" }}
					/>
				</>
			)}
			<span className="relative flex items-center gap-1">
				{StatusIcon}
				{children}
			</span>
		</span>
	);
};

// Helper function to map status to variant
function getVariantFromStatus(status: string): LabelVariant {
	const upperStatus = status.toUpperCase();

	// '+RECEIVED','+PENDING','+RETRYING','+QUEUED','+STARTED','+DOWNLOADING','+DOWNLOADED','+ANALYZING','+ANALYZED','+PROCESSING','+PROCESSED','+UPLOADING','+UPLOADED','+COMPLETED','+CANCELLED','+DELETED','+FAILED','+TIMEOUT'
	// '+PENDING','+RETRYING','+QUEUED','+SUCCESSFUL','+SKIPPED','+FAILED'
	// '+ONLINE','+OFFLINE'
	// '+IDLE','+BUSY','+TIMEOUT','+TERMINATED'

	// Success statuses
	if (["SUCCESS", "SUCCESSFUL", "ONLINE", "BUSY", "COMPLETED"].includes(upperStatus)) {
		return "success";
	}

	// Error statuses
	if (["ERROR", "OFFLINE", "FAILED", "TERMINATED"].includes(upperStatus)) {
		// , "CANCELLED", "DELETED", "TIMEOUT"
		return "error";
	}

	// Warning/Pending statuses
	if (["WARNING", "PENDING", "RETRYING", "QUEUED"].includes(upperStatus)) {
		return "warning";
	}

	// Info/Running statuses
	if (
		[
			"INFO",
			"STARTED",
			"DOWNLOADING",
			"DOWNLOADED",
			"ANALYZING",
			"ANALYZED",
			"PROCESSING",
			"PROCESSED",
			"UPLOADING",
			"UPLOADED"
		].includes(upperStatus)
	) {
		return "info";
	}

	if (["PURPLE", "MASTER"].includes(upperStatus)) {
		return "purple";
	}

	if (["BLUE", "SLAVE"].includes(upperStatus)) {
		return "blue";
	}

	// Cancelled/Debug/Unknown statuses
	if (["GRAY", "DEBUG", "UNKNOWN"].includes(upperStatus)) {
		return "gray";
	}

	// Default
	return "gray";
}

export default Label;
