import React, { useMemo } from "react";
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { clsx } from "@/utils";

export interface SelectOption<T = string> {
	value: T;
	label: string;
	icon?: React.ReactNode;
	description?: string;
}

interface SelectProps<T = string> {
	value: T;
	onChange: (value: T) => void;
	options: SelectOption<T>[];
	placeholder?: string;
	searchable?: boolean;
	className?: string;
	disabled?: boolean;
	allowEmpty?: boolean;
	emptyLabel?: string;
}

export const Select = <T extends string = string>({
	value,
	onChange,
	options,
	placeholder = "Select...",
	searchable = true,
	className = "",
	disabled = false,
	allowEmpty = true,
	emptyLabel = "All"
}: SelectProps<T>) => {
	const [query, setQuery] = React.useState("");
	const buttonRef = React.useRef<HTMLButtonElement>(null);
	const inputRef = React.useRef<HTMLInputElement>(null);

	// Find selected option
	const selectedOption = options.find((opt) => opt.value === value);

	// Filter options based on search query
	const filteredOptions = useMemo(() => {
		if (!searchable || query === "") {
			return options;
		}
		return options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));
	}, [options, query, searchable]);

	const showEmptyOption = useMemo(() => {
		return emptyLabel.toLowerCase().trim().includes(query);
	}, [emptyLabel, query]);

	const hasValue = value && value !== "";
	const showClearButton = allowEmpty && hasValue;

	const handleChange = (newValue: T | null) => {
		setQuery(""); // Clear query when selecting an option
		if (newValue !== null) {
			onChange?.(newValue);
		}
	};

	const handleClear = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setQuery("");
		onChange("" as T);
	};

	return (
		<Combobox
			value={value}
			onChange={handleChange}
			disabled={disabled}>
			{({ open }) => {
				const handleInputClick = (e: React.MouseEvent) => {
					if (!disabled) {
						// Don't trigger if clicking directly on the button
						if (buttonRef.current && buttonRef.current.contains(e.target as Node)) {
							return;
						}

						// Only open if not already open to avoid toggling closed when clicking input to search
						if (!open) {
							buttonRef.current?.click();
						}
					}
				};

				const handleButtonClick = (e: React.MouseEvent) => {
					// Only clear if it's a direct click on the button (not triggered programmatically)
					if (showClearButton && e.isTrusted) {
						handleClear(e);
						return; // Prevent dropdown from opening
					}
					// Let ComboboxButton handle dropdown toggle by default
				};

				return (
					<div className={clsx("relative", className)}>
						<div
							className="relative"
							onClick={handleInputClick}>
							<ComboboxInput
								ref={inputRef}
								className={clsx(
									"h-[38px] w-full rounded-md border border-gray-300 dark:border-neutral-600",
									"bg-white dark:bg-neutral-800",
									"pl-3 pr-10 text-left",
									"text-gray-900 dark:text-gray-100",
									"focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500",
									"sm:text-sm",
									"disabled:opacity-50 disabled:cursor-not-allowed",
									"cursor-pointer"
								)}
								displayValue={() => query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder={value ? "" : allowEmpty ? emptyLabel : placeholder}
								readOnly={!searchable}
								autoComplete="off"
							/>

							{/* Show selected value in background when query is empty */}
							{query === "" && selectedOption && (
								<div className="absolute inset-y-0 left-0 right-10 flex items-center pl-3 sm:text-sm pointer-events-none text-gray-900 dark:text-gray-100">
									{selectedOption?.icon && query === "" && (
										<div className="flex items-center pr-2 pointer-events-none">{selectedOption.icon}</div>
									)}
									{selectedOption.label}
								</div>
							)}

							<ComboboxButton
								ref={buttonRef}
								onClick={handleButtonClick}
								className={clsx(
									"absolute inset-y-0 right-0 flex items-center pr-2 transition-colors",
									"[&>svg]:hover:text-gray-600 dark:[&>svg]:hover:text-gray-300"
								)}>
								{showClearButton ? (
									<XMarkIcon
										className="h-5 w-5 text-gray-400 transition-colors"
										aria-hidden="true"
									/>
								) : (
									<ChevronUpDownIcon
										className="h-5 w-5 text-gray-400 transition-colors"
										aria-hidden="true"
									/>
								)}
							</ComboboxButton>
						</div>
						<ComboboxOptions
							className={clsx(
								"absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md",
								"bg-white dark:bg-neutral-800",
								"py-1 shadow-lg ring-1 ring-black ring-opacity-5",
								"focus:outline-none sm:text-sm"
							)}>
							{allowEmpty && showEmptyOption && (
								<ComboboxOption
									value={"" as T}
									className={({ focus }) =>
										clsx(
											"relative cursor-pointer select-none py-2 pl-3 pr-9",
											focus ? "bg-gray-100 dark:bg-neutral-700" : ""
										)
									}>
									{({ focus, selected }) => (
										<>
											<span className={clsx("block truncate", selected ? "font-semibold" : "font-normal")}>
												{emptyLabel}
											</span>
											{selected && (
												<span
													className={clsx(
														"absolute inset-y-0 right-0 flex items-center pr-4",
														focus ? "text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"
													)}>
													<CheckIcon
														className="h-4 w-4"
														aria-hidden="true"
													/>
												</span>
											)}
										</>
									)}
								</ComboboxOption>
							)}

							{filteredOptions.length === 0 && query !== "" ? (
								<div className="relative cursor-default select-none py-2 px-4 text-gray-700 dark:text-gray-300">
									No results found.
								</div>
							) : (
								filteredOptions.map((option) => (
									<ComboboxOption
										key={option.value}
										value={option.value}
										className={({ focus }) =>
											clsx(
												"relative cursor-pointer select-none py-2 pr-9",
												option.icon ? "pl-10" : "pl-3",
												focus ? "bg-gray-100 dark:bg-neutral-700" : ""
											)
										}>
										{({ focus, selected }) => (
											<>
												{option.icon && (
													<span
														className={clsx(
															"absolute inset-y-0 left-0 flex items-center pl-3",
															selected
																? "text-gray-900 dark:text-gray-100"
																: "text-gray-600 dark:text-gray-400"
														)}>
														{option.icon}
													</span>
												)}
												<div className="flex flex-col">
													<span className={clsx("block truncate", selected ? "font-semibold" : "font-normal")}>
														{option.label}
													</span>
													{option.description && (
														<span className="text-xs text-gray-500 dark:text-gray-400">
															{option.description}
														</span>
													)}
												</div>
												{selected && (
													<span
														className={clsx(
															"absolute inset-y-0 right-0 flex items-center pr-4",
															focus ? "text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"
														)}>
														<CheckIcon
															className="h-5 w-5"
															aria-hidden="true"
														/>
													</span>
												)}
											</>
										)}
									</ComboboxOption>
								))
							)}
						</ComboboxOptions>
					</div>
				);
			}}
		</Combobox>
	);
};

export default Select;
