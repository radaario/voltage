interface LoadingSpinnerProps {
	size?: "sm" | "md" | "lg";
	centered?: boolean;
	className?: string;
}

const sizeClasses = {
	sm: "h-6 w-6",
	md: "h-10 w-10",
	lg: "h-16 w-16"
};

export function LoadingSpinner({ size = "md", centered = true, className = "" }: LoadingSpinnerProps) {
	const spinner = (
		<div
			className={`animate-spin rounded-full border-2 border-b-gray-900 dark:border-b-white border-gray-300 dark:border-gray-600 ${sizeClasses[size]} ${className}`}
		/>
	);

	if (centered) {
		return <div className="flex justify-center items-center h-64">{spinner}</div>;
	}

	return spinner;
}

export default LoadingSpinner;
