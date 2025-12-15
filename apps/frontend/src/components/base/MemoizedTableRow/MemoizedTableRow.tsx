import { memo } from "react";
import { flexRender } from "@tanstack/react-table";

import type { Row } from "@tanstack/react-table";

interface MemoizedTableRowProps<T> {
	row: Row<T>;
	isNew?: boolean;
	onClick?: (data: T) => void;
	className?: string;
}

function MemoizedTableRowComponent<T>({ row, isNew = false, onClick, className = "" }: MemoizedTableRowProps<T>) {
	const handleClick = () => {
		if (onClick) {
			onClick(row.original);
		}
	};

	const baseClassName = "group hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all";
	const cursorClassName = onClick ? "cursor-pointer" : "";
	const highlightClassName = isNew ? "animate-slide-in-highlight" : "";
	const combinedClassName = `${baseClassName} ${cursorClassName} ${highlightClassName} ${className}`.trim();

	return (
		<tr
			onClick={handleClick}
			className={combinedClassName}>
			{row.getVisibleCells().map((cell) => (
				<td
					key={cell.id}
					data-label={cell.column.columnDef.header}
					className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
					{flexRender(cell.column.columnDef.cell, cell.getContext())}
				</td>
			))}
		</tr>
	);
}

// Memoize the component with custom comparison
export const MemoizedTableRow = memo(MemoizedTableRowComponent, (prevProps, nextProps) => {
	return (
		prevProps.row.id === nextProps.row.id && prevProps.row.original === nextProps.row.original && prevProps.isNew === nextProps.isNew
	);
}) as typeof MemoizedTableRowComponent;
