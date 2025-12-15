import React, { Component, ReactNode } from "react";
import { ExclamationTriangleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
	errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null
		};
	}

	static getDerivedStateFromError(_error: Error): Partial<State> {
		return { hasError: true };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error("ErrorBoundary caught an error:", error, errorInfo);
		this.setState({
			error,
			errorInfo
		});
	}

	handleReload = () => {
		window.location.reload();
	};

	handleReset = () => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null
		});
	};

	render() {
		if (this.state.hasError) {
			return (
				<div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center p-4">
					<div className="max-w-2xl w-full bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
						{/* Header */}
						<div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-6 py-4">
							<div className="flex items-center gap-3">
								<ExclamationTriangleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
								<div>
									<h1 className="text-xl font-semibold text-red-900 dark:text-red-200">Something went wrong</h1>
									<p className="text-sm text-red-700 dark:text-red-300 mt-0.5">
										The application encountered an unexpected error
									</p>
								</div>
							</div>
						</div>

						{/* Body */}
						<div className="p-6 space-y-4">
							{/* Error Message */}
							{this.state.error && (
								<div>
									<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Error Message</h3>
									<div className="bg-gray-100 dark:bg-neutral-900 rounded p-3 border border-gray-200 dark:border-neutral-700">
										<code className="text-sm text-red-600 dark:text-red-400 break-words">
											{this.state.error.message || "Unknown error"}
										</code>
									</div>
								</div>
							)}

							{/* Error Stack (collapsed by default) */}
							{this.state.errorInfo && import.meta.env.DEV && (
								<details className="group">
									<summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
										Technical Details (Development Only)
									</summary>
									<div className="mt-2 bg-gray-100 dark:bg-neutral-900 rounded p-3 border border-gray-200 dark:border-neutral-700 max-h-60 overflow-auto">
										<pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words">
											{this.state.errorInfo.componentStack}
										</pre>
									</div>
								</details>
							)}

							{/* Suggestions */}
							<div>
								<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">What you can do:</h3>
								<ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
									<li>Try reloading the page</li>
									<li>Clear your browser cache and cookies</li>
									<li>Check your internet connection</li>
									<li>Contact support if the problem persists</li>
								</ul>
							</div>
						</div>

						{/* Footer Actions */}
						<div className="bg-gray-50 dark:bg-neutral-900/50 border-t border-gray-200 dark:border-neutral-700 px-6 py-4 flex items-center justify-end gap-3">
							<button
								onClick={this.handleReset}
								className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors">
								Try Again
							</button>
							<button
								onClick={this.handleReload}
								className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded transition-colors inline-flex items-center gap-2">
								<ArrowPathIcon className="w-4 h-4" />
								Reload Page
							</button>
						</div>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

export default ErrorBoundary;
