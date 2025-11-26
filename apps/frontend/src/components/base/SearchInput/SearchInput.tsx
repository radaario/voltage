import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface SearchInputProps {
	value: string;
	onChange: (value: string) => void;
	onClear: () => void;
	placeholder?: string;
	className?: string;
}

export function SearchInput({ value, onChange, onClear, placeholder = "Search...", className = "" }: SearchInputProps) {
	return (
		<div className={`relative flex-1 sm:w-64 ${className}`}>
			<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
				<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
			</div>
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className="block w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-neutral-600 rounded-md leading-5 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 sm:text-sm"
			/>
			{value && (
				<button
					type="button"
					onClick={onClear}
					className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
					<XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
				</button>
			)}
		</div>
	);
}

export default SearchInput;
