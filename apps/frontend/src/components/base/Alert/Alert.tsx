import React from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

export type AlertVariant = "success" | "error" | "warning" | "info";

interface AlertProps {
	variant?: AlertVariant;
	children: React.ReactNode;
	className?: string;
	onClose?: () => void;
}

const Alert: React.FC<AlertProps> = ({ variant = "info", children, className = "", onClose }) => {
	const variantClasses = {
		success: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200",
		error: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200",
		warning: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200",
		info: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200"
	};

	const hoverClasses = {
		success: "hover:bg-green-200 dark:hover:bg-green-800",
		error: "hover:bg-red-200 dark:hover:bg-red-800",
		warning: "hover:bg-yellow-200 dark:hover:bg-yellow-800",
		info: "hover:bg-blue-200 dark:hover:bg-blue-800"
	};

	return (
		<div className={`rounded-md p-4 border text-sm flex items-center justify-between gap-3 ${variantClasses[variant]} ${className}`}>
			<div className="flex-1">{children}</div>
			{onClose && (
				<button
					type="button"
					onClick={onClose}
					className={`shrink-0 p-1 rounded transition-colors ${hoverClasses[variant]}`}>
					<XMarkIcon className="h-5 w-5" />
				</button>
			)}
		</div>
	);
};

export default Alert;
