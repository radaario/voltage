import type { ButtonProps } from "@/types";

const variantClasses = {
	primary: "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 hover:shadow-lg",
	secondary: "bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-600",
	danger: "bg-red-600 text-white hover:bg-red-700 hover:shadow-lg",
	warning: "bg-yellow-600 text-white hover:bg-yellow-700 hover:shadow-lg",
	info: "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg",
	ghost: "bg-transparent enabled:hover:bg-gray-100 dark:enabled:hover:bg-neutral-700 text-gray-700 dark:text-gray-300",
	soft: "bg-gray-100 dark:bg-neutral-900 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700",
	"outline-primary":
		"border-2 border-neutral-900 dark:border-white text-neutral-900 dark:text-white bg-transparent hover:bg-neutral-900 dark:hover:bg-white hover:text-white dark:hover:text-neutral-900 hover:shadow-lg",
	"outline-secondary":
		"border-2 border-gray-400 dark:border-neutral-500 text-gray-700 dark:text-gray-300 bg-transparent hover:bg-gray-400 dark:hover:bg-neutral-500 hover:text-white",
	"outline-danger":
		"border-2 border-red-600 dark:border-red-500 text-red-600 dark:text-red-500 bg-transparent hover:bg-red-600 dark:hover:bg-red-500 hover:text-white hover:shadow-lg"
};

const hoverClasses = {
	primary: "enabled:hover:bg-neutral-800 dark:enabled:hover:bg-neutral-100 enabled:hover:shadow-lg",
	secondary: "enabled:hover:bg-gray-200 dark:enabled:hover:bg-neutral-600",
	danger: "enabled:hover:bg-red-700 enabled:hover:text-white enabled:hover:shadow-lg",
	warning: "enabled:hover:bg-yellow-700 enabled:hover:text-white enabled:hover:shadow-lg",
	info: "enabled:hover:bg-blue-700 enabled:hover:text-white enabled:hover:shadow-lg",
	ghost: "enabled:hover:bg-gray-100 dark:enabled:hover:bg-neutral-700",
	soft: "enabled:hover:bg-gray-200 dark:enabled:hover:bg-neutral-700",
	"text-primary": "enabled:hover:text-neutral-900 dark:enabled:hover:text-white",
	"text-secondary": "enabled:hover:text-gray-600 dark:enabled:hover:text-gray-400",
	"text-danger": "enabled:hover:text-red-600 dark:enabled:hover:text-red-400",
	"text-warning": "enabled:hover:text-yellow-600 dark:enabled:hover:text-yellow-400",
	"text-success": "enabled:hover:text-green-600 dark:enabled:hover:text-green-400"
};

const sizeClasses = {
	xs: "py-[5px] px-2 text-xs",
	sm: "py-2 px-4 text-sm",
	md: "py-3 px-6 text-base",
	lg: "py-4 px-8 text-lg"
};

const iconOnlySizeClasses = {
	xs: "p-1",
	sm: "p-1.5",
	md: "p-2",
	lg: "p-3"
};

function Button({
	variant = "primary",
	size = "md",
	isLoading = false,
	iconOnly = false,
	rounded = "md",
	hover,
	disabled,
	children,
	className = "",
	...props
}: ButtonProps) {
	const baseClasses = `font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none flex items-center gap-2`;

	const sizeClass = iconOnly ? iconOnlySizeClasses[size] : sizeClasses[size];

	// If hover prop is provided, use base variant + custom hover, otherwise use default variantClasses
	const variantClass = hover ? `${variantClasses[variant]} ${hoverClasses[hover]}` : variantClasses[variant];

	return (
		<button
			className={`${baseClasses} ${variantClass} ${sizeClass} ${className} rounded-${rounded}`}
			disabled={disabled || isLoading}
			{...props}>
			{isLoading && <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" />}
			{children}
		</button>
	);
}

export default Button;
