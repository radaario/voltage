import { useRouteError, isRouteErrorResponse } from "react-router-dom";
import { ExclamationTriangleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

const RouterErrorBoundary = () => {
	const error = useRouteError();

	const handleReload = () => {
		window.location.href = "/";
	};

	let errorMessage = "An unexpected error occurred";
	let errorDetails = "";

	if (isRouteErrorResponse(error)) {
		errorMessage = error.statusText || errorMessage;
		errorDetails = error.data?.message || "";
	} else if (error instanceof Error) {
		errorMessage = error.message;
		errorDetails = error.stack || "";
	}

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center p-4">
			<div className="max-w-2xl w-full bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
				{/* Header */}
				<div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-6 py-4">
					<div className="flex items-center gap-3">
						<ExclamationTriangleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
						<div>
							<h1 className="text-xl font-semibold text-red-900 dark:text-red-200">Something went wrong</h1>
							<p className="text-sm text-red-700 dark:text-red-300 mt-0.5">The application encountered an unexpected error</p>
						</div>
					</div>
				</div>

				{/* Body */}
				<div className="p-6 space-y-4">
					{/* Error Message */}
					<div>
						<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Error Message</h3>
						<div className="bg-gray-100 dark:bg-neutral-900 rounded p-3 border border-gray-200 dark:border-neutral-700">
							<code className="text-sm text-red-600 dark:text-red-400 break-words">{errorMessage}</code>
						</div>
					</div>

					{/* Error Stack (collapsed by default) */}
					{errorDetails && import.meta.env.DEV && (
						<details className="group">
							<summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
								Technical Details (Development Only)
							</summary>
							<div className="mt-2 bg-gray-100 dark:bg-neutral-900 rounded p-3 border border-gray-200 dark:border-neutral-700 max-h-60 overflow-auto">
								<pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words">
									{errorDetails}
								</pre>
							</div>
						</details>
					)}

					{/* Suggestions */}
					<div>
						<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">What you can do:</h3>
						<ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
							<li>Try going back to the home page</li>
							<li>Clear your browser cache and cookies</li>
							<li>Check your internet connection</li>
							<li>Contact support if the problem persists</li>
						</ul>
					</div>
				</div>

				{/* Footer Actions */}
				<div className="bg-gray-50 dark:bg-neutral-900/50 border-t border-gray-200 dark:border-neutral-700 px-6 py-4 flex items-center justify-end gap-3">
					<button
						onClick={handleReload}
						className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded transition-colors inline-flex items-center gap-2">
						<ArrowPathIcon className="w-4 h-4" />
						Go to Home
					</button>
				</div>
			</div>
		</div>
	);
};

export default RouterErrorBoundary;
