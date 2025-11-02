import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	error?: string;
	helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, helperText, className = "", id, ...props }, ref) => {
	const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

	return (
		<div className="space-y-2">
			{label && (
				<label
					htmlFor={inputId}
					className="block text-sm font-medium text-gray-700 dark:text-gray-300">
					{label}
				</label>
			)}
			<input
				id={inputId}
				ref={ref}
				className={`w-full h-12 border ${
					error
						? "border-red-500 dark:border-red-600 focus:ring-red-500"
						: "border-gray-300 dark:border-neutral-600 focus:ring-neutral-500"
				} outline-0 rounded-lg text-base px-4 bg-white dark:bg-neutral-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all duration-200 focus:ring-2 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
				{...props}
			/>
			{error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
			{helperText && !error && <p className="text-sm text-gray-500 dark:text-gray-400">{helperText}</p>}
		</div>
	);
});

Input.displayName = "Input";

export default Input;
