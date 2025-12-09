import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components";

interface PaginationProps {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
	onPageChange: (page: number) => void;
	onLimitChange?: (limit: number) => void;
}

function Pagination({
	currentPage,
	totalPages,
	totalItems,
	itemsPerPage,
	hasNextPage,
	hasPrevPage,
	onPageChange,
	onLimitChange
}: PaginationProps) {
	const getPageNumbers = () => {
		const pages: (number | string)[] = [];
		const maxVisible = 5;

		if (totalPages <= maxVisible + 2) {
			// Show all pages if total is small
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			// Always show first page
			pages.push(1);

			let start: number;
			let end: number;

			if (currentPage <= 3) {
				// Near the beginning
				start = 2;
				end = maxVisible;
			} else if (currentPage >= totalPages - 2) {
				// Near the end
				start = totalPages - maxVisible + 1;
				end = totalPages - 1;
			} else {
				// In the middle
				start = currentPage - 1;
				end = currentPage + 1;
			}

			// Add ellipsis if there's a gap after first page
			if (start > 2) {
				pages.push("...");
			}

			// Add middle pages
			for (let i = start; i <= end; i++) {
				pages.push(i);
			}

			// Add ellipsis if there's a gap before last page
			if (end < totalPages - 1) {
				pages.push("...");
			}

			// Always show last page
			pages.push(totalPages);
		}

		return pages;
	};

	const pageNumbers = getPageNumbers();
	const startItem = (currentPage - 1) * itemsPerPage + 1;
	const endItem = Math.min(currentPage * itemsPerPage, totalItems);

	return (
		<div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-200 dark:border-neutral-700">
			{/* Pagination Controls */}
			<div className="flex items-center gap-1 order-2 sm:order-1">
				{/* First Page Button */}
				<Button
					variant="ghost"
					size="sm"
					iconOnly
					onClick={() => onPageChange(1)}
					disabled={!hasPrevPage}
					title="First page"
					className="border border-gray-300 dark:border-neutral-600 w-9! h-9! p-0!">
					<ChevronDoubleLeftIcon className="w-4 h-4" />
				</Button>

				{/* Previous Page Button */}
				<Button
					variant="ghost"
					size="sm"
					iconOnly
					onClick={() => onPageChange(currentPage - 1)}
					disabled={!hasPrevPage}
					title="Previous page"
					className="border border-gray-300 dark:border-neutral-600 w-9! h-9! p-0!">
					<ChevronLeftIcon className="w-4 h-4" />
				</Button>

				{/* Page Numbers */}
				<div className="hidden sm:flex items-center gap-1">
					{pageNumbers.map((pageNum, index) =>
						pageNum === "..." ? (
							<span
								key={`ellipsis-${index}`}
								className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
								...
							</span>
						) : (
							<Button
								key={pageNum}
								variant={currentPage === pageNum ? "primary" : "ghost"}
								hover={currentPage === pageNum ? "primary" : "secondary"}
								size="sm"
								onClick={() => onPageChange(Number(pageNum))}
								className={`w-9! h-9! p-0! ${currentPage === pageNum ? "" : "border border-gray-300 dark:border-neutral-600"}`}>
								{pageNum}
							</Button>
						)
					)}
				</div>

				{/* Mobile: Current Page Indicator */}
				<div className="sm:hidden px-3 py-2 text-sm text-gray-700 dark:text-gray-300 font-medium">
					{currentPage} / {totalPages}
				</div>

				{/* Next Page Button */}
				<Button
					variant="ghost"
					hover="secondary"
					size="sm"
					iconOnly
					onClick={() => onPageChange(currentPage + 1)}
					disabled={!hasNextPage}
					title="Next page"
					className="border border-gray-300 dark:border-neutral-600 w-9! h-9! p-0!">
					<ChevronRightIcon className="w-4 h-4" />
				</Button>

				{/* Last Page Button */}
				<Button
					variant="ghost"
					hover="secondary"
					size="sm"
					iconOnly
					onClick={() => onPageChange(totalPages)}
					disabled={!hasNextPage}
					title="Last page"
					className="border border-gray-300 dark:border-neutral-600 w-9! h-9! p-0!">
					<ChevronDoubleRightIcon className="w-4 h-4" />
				</Button>
			</div>

			{/* Info Text & Items Per Page */}
			<div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 order-1 sm:order-2">
				<div>
					Showing <span className="font-medium text-gray-900 dark:text-white">{startItem}</span> to{" "}
					<span className="font-medium text-gray-900 dark:text-white">{endItem}</span> of{" "}
					<span className="font-medium text-gray-900 dark:text-white">{totalItems}</span> results
				</div>
				{onLimitChange && (
					<select
						value={itemsPerPage}
						onChange={(e) => onLimitChange(Number(e.target.value))}
						className="px-3 py-1.5 text-sm border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-500">
						{[10, 25, 50, 100].map((pageSize) => (
							<option
								key={pageSize}
								value={pageSize}>
								{pageSize} per page
							</option>
						))}
					</select>
				)}
			</div>
		</div>
	);
}

export default Pagination;
