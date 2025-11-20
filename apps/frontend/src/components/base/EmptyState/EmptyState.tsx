interface EmptyStateProps {
	message: string;
	colSpan: number;
}

function EmptyState({ message, colSpan }: EmptyStateProps) {
	return (
		<tr>
			<td
				colSpan={colSpan}
				className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
				{message}
			</td>
		</tr>
	);
}

export default EmptyState;
