import { clsx } from "@/utils";
import React from "react";

export type LabelSize = "sm" | "md" | "lg";
export type LabelVariant = "success" | "error" | "warning" | "info" | "gray" | "blue" | "purple" | "green" | "red" | "yellow";

interface LabelProps {
	children: React.ReactNode;
	size?: LabelSize;
	variant?: LabelVariant;
	status?: string; // If provided, will override variant based on status
	hidden?: string;
	className?: string;
}

const Label: React.FC<LabelProps> = ({ children, size = "md", variant = "gray", status, hidden = "", className = "" }) => {
	// Determine variant from status if provided
	const finalVariant = status ? getVariantFromStatus(status) : variant;

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
		warning: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
		info: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
		gray: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800",
		blue: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
		purple: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
		green: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
		red: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
		yellow: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"
	};

	return (
		<span
			className={clsx(
				`items-center font-semibold rounded border`,
				{
					"inline-flex": !hidden,
					[`hidden ${hidden}:inline-flex`]: hidden
				},
				sizeClasses[size],
				variantClasses[finalVariant],
				className
			)}>
			{children}
		</span>
	);
};

// Helper function to map status to variant
function getVariantFromStatus(status: string): LabelVariant {
	const upperStatus = status.toUpperCase();

	// Success statuses
	if (upperStatus === "COMPLETED" || upperStatus === "SUCCESS" || upperStatus === "SUCCESSFUL" || upperStatus === "ACTIVE") {
		return "success";
	}

	// Error statuses
	if (upperStatus === "FAILED" || upperStatus === "ERROR") {
		return "error";
	}

	// Warning/Pending statuses
	if (
		upperStatus === "PENDING" ||
		upperStatus === "QUEUED" ||
		upperStatus === "WARNING" ||
		upperStatus === "DOWNLOADING" ||
		upperStatus === "ANALYZING"
	) {
		return "warning";
	}

	// Info/Running statuses
	if (upperStatus === "RUNNING" || upperStatus === "ENCODING" || upperStatus === "UPLOADING" || upperStatus === "INFO") {
		return "info";
	}

	// Cancelled/Debug/Unknown statuses
	if (upperStatus === "CANCELLED" || upperStatus === "DEBUG" || upperStatus === "UNKNOWN") {
		return "gray";
	}

	// Default
	return "gray";
}

export default Label;
