import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "danger" | "ghost";
	size?: "sm" | "md" | "lg";
	isLoading?: boolean;
	children: ReactNode;
}

const variantClasses = {
	primary: "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 hover:shadow-lg",
	secondary: "bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-600",
	danger: "bg-red-600 text-white hover:bg-red-700 hover:shadow-lg",
	ghost: "bg-transparent hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300"
};

const sizeClasses = {
	sm: "py-2 px-4 text-sm",
	md: "py-3 px-6 text-base",
	lg: "py-4 px-8 text-lg"
};

function Button({ variant = "primary", size = "md", isLoading = false, disabled, children, className = "", ...props }: ButtonProps) {
	const baseClasses =
		"rounded-lg font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none flex items-center justify-center gap-2";

	return (
		<button
			className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
			disabled={disabled || isLoading}
			{...props}>
			{isLoading && <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" />}
			{children}
		</button>
	);
}

export default Button;
