interface EmptyStateProps {
	message: string;
	colSpan: number;
}

function EmptyState({ message, colSpan }: EmptyStateProps) {
	return (
		<tr>
			<td
				colSpan={colSpan}
				data-no-label="true"
				className="px-6 py-12 justify-center text-center text-sm text-gray-500 dark:text-gray-400">
				{message}
			</td>
		</tr>
	);
}

export default EmptyState;
