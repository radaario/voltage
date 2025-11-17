import React, { useEffect, useState } from "react";
import { useNavigate, useParams, NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { XMarkIcon, DocumentTextIcon, CircleStackIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import type { Log } from "@/interfaces/log";
import Label from "@/components/base/Label/Label";
import { api, ApiResponse } from "@/utils";

const LogDetailModal: React.FC = () => {
	const { logKey } = useParams<{ logKey: string }>();
	const navigate = useNavigate();
	const { authToken } = useAuth();
	const [isAnimating, setIsAnimating] = useState(false);

	// Fetch log details
	const { data: logResponse, isLoading } = useQuery<ApiResponse<Log>>({
		queryKey: ["log", logKey],
		queryFn: async () => {
			return await api.get<Log>("/logs", {
				token: authToken || "",
				log_key: logKey || ""
			});
		},
		enabled: !!logKey && !!authToken
	});

	const log = logResponse?.data;

	useEffect(() => {
		const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
		document.body.style.overflow = "hidden";
		document.body.style.paddingRight = `${scrollbarWidth}px`;
		setTimeout(() => setIsAnimating(true), 10);

		return () => {
			document.body.style.overflow = "unset";
			document.body.style.paddingRight = "";
		};
	}, []);

	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				handleClose();
			}
		};

		window.addEventListener("keydown", handleEscape);
		return () => window.removeEventListener("keydown", handleEscape);
	}, []);

	const handleClose = () => {
		setIsAnimating(false);
		setTimeout(() => {
			navigate("/logs");
		}, 300);
	};

	const tabs = [
		{ path: "log", label: "Log", icon: DocumentTextIcon },
		{ path: "metadata", label: "Metadata", icon: CircleStackIcon }
	];

	const ModalContent = (
		<div className="fixed inset-0 z-60 overflow-y-auto">
			{/* Backdrop */}
			<div
				className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
					isAnimating ? "opacity-100" : "opacity-0"
				}`}
				onClick={handleClose}
			/>

			{/* Modal Container */}
			<div className="flex min-h-full items-center justify-center p-4">
				{/* Modal Panel */}
				<div
					className={`relative overflow-hidden w-full max-w-4xl h-[80vh] flex flex-col bg-white dark:bg-neutral-800 rounded-2xl shadow-xl z-10 transition-all duration-300 ${
						isAnimating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
					}`}
					onClick={(e) => e.stopPropagation()}>
					{/* Header */}
					<div className="shrink-0 flex items-start justify-between p-6 border-b border-gray-200 dark:border-neutral-700">
						<div className="flex items-start gap-3">
							<DocumentTextIcon className="h-7 w-7 text-gray-600 dark:text-gray-400 mt-0.5" />
							<div>
								{log ? (
									<>
										<div className="flex items-center gap-3">
											<h3 className="text-2xl font-bold text-gray-900 dark:text-white">Log Detail</h3>
											<Label
												size="md"
												status={log.type}>
												{log.type || "UNKNOWN"}
											</Label>
										</div>
										<p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">{log.key}</p>
									</>
								) : (
									<h3 className="text-2xl font-bold text-gray-900 dark:text-white">Loading...</h3>
								)}
							</div>
						</div>
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={handleClose}
								className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg transition-colors">
								<XMarkIcon className="h-6 w-6" />
							</button>
						</div>
					</div>

					{/* Tabs */}
					<div className="shrink-0 border-b border-gray-200 dark:border-neutral-700">
						<nav className="flex px-6 gap-8">
							{tabs.map((tab) => (
								<NavLink
									key={tab.path}
									to={tab.path}
									className={({ isActive }) =>
										`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
											isActive
												? "border-neutral-700 text-gray-900 dark:border-neutral-400 dark:text-white"
												: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
										}`
									}>
									<tab.icon className="h-4 w-4" />
									{tab.label}
								</NavLink>
							))}
						</nav>
					</div>

					{/* Tab Content */}
					<div className="flex-1 overflow-y-auto p-6">
						{isLoading ? (
							<div className="flex justify-center items-center py-12">
								<div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-500 dark:border-gray-400 border-t-transparent"></div>
							</div>
						) : !log ? (
							<div className="flex flex-col justify-center items-center py-12 gap-3">
								<p className="text-sm text-gray-600 dark:text-gray-400">Log not found.</p>
								<button
									onClick={handleClose}
									className="px-3 py-1.5 bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors">
									Close
								</button>
							</div>
						) : (
							<Outlet context={{ log }} />
						)}
					</div>
				</div>
			</div>
		</div>
	);

	return createPortal(ModalContent, document.body);
};

export default LogDetailModal;
