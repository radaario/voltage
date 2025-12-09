interface LoadingOverlayProps {
	show: boolean;
}

function LoadingOverlay({ show }: LoadingOverlayProps) {
	if (!show) return null;

	return (
		<div className="absolute inset-0 bg-white/50 dark:bg-neutral-900/50 flex items-center justify-center z-10 rounded-lg">
			<div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-500 dark:border-gray-400 border-t-transparent"></div>
		</div>
	);
}

export default LoadingOverlay;
