import { useEffect, useState } from "react";
import { useNavigate, useParams, NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import {
	XMarkIcon,
	InformationCircleIcon,
	ArrowDownTrayIcon,
	ArrowUpTrayIcon,
	DocumentTextIcon,
	BellIcon,
	BellAlertIcon,
	ClipboardDocumentCheckIcon,
	FolderArrowDownIcon,
	DocumentChartBarIcon
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import Label from "@/components/base/Label/Label";
import type { Job } from "@/interfaces/job";
import { JobPreviewImage } from "@/components/composite/JobPreviewImage";

const JobDetailModal: React.FC = () => {
	const { jobKey } = useParams<{ jobKey: string }>();
	const navigate = useNavigate();
	const { authToken } = useAuth();
	const [isAnimating, setIsAnimating] = useState(false);

	// Fetch job details
	const { data: jobResponse, isLoading } = useQuery<ApiResponse<Job>>({
		queryKey: ["job", jobKey],
		queryFn: () =>
			api.get<Job>("/jobs", {
				token: authToken || "",
				job_key: jobKey || ""
			}),
		enabled: !!jobKey && !!authToken
	});

	const job = jobResponse?.data;
	const filename = job?.input?.file_name || job?.input?.url?.split("/").pop() || "Unknown";
	const specs: string[] = [];

	// Resolution
	const width = job?.input?.video_width;
	const height = job?.input?.video_height;
	if (width && height) {
		specs.push(`${width}x${height}px`);
	}

	// Size
	const size = job?.input?.file_size;
	if (size) {
		const sizeInMB = (size / (1024 * 1024)).toFixed(1);
		specs.push(`${sizeInMB}mb`);
	}

	useEffect(() => {
		// Get scrollbar width before hiding
		const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
		document.body.style.overflow = "hidden";
		document.body.style.paddingRight = `${scrollbarWidth}px`;
		// Trigger animation after render
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

		return () => {
			window.removeEventListener("keydown", handleEscape);
		};
	}, []);

	const handleClose = () => {
		setIsAnimating(false);
		setTimeout(() => {
			navigate("/jobs");
		}, 300);
	};

	const tabs = [
		{ path: "info", label: "Info", icon: InformationCircleIcon },
		{ path: "input", label: "Input", icon: ArrowDownTrayIcon },
		{ path: "outputs", label: "Outputs", icon: ArrowUpTrayIcon },
		{ path: "outcome", label: "Outcome", icon: ClipboardDocumentCheckIcon },
		{ path: "notifications", label: "Notifications", icon: BellIcon },
		{ path: "logs", label: "Logs", icon: DocumentTextIcon }
	];

	const ModalContent = (
		<div className="fixed inset-0 z-50 overflow-y-auto">
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
					className={`relative overflow-hidden w-full max-w-5xl h-[85vh] flex flex-col bg-white dark:bg-neutral-800 rounded-2xl shadow-xl z-10 transition-all duration-300 ${
						isAnimating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
					}`}
					onClick={(e) => e.stopPropagation()}>
					{/* Header */}
					<div className="shrink-0 flex items-start justify-between p-6 border-b border-gray-200 dark:border-neutral-700">
						<div className="flex items-center gap-4 mr-3 overflow-hidden">
							{/* Preview Image */}
							{job && (
								<JobPreviewImage
									className="w-24 h-16 relative shrink-0 bg-gray-100 dark:bg-neutral-700 rounded overflow-hidden"
									jobKey={job.key}
									authToken={authToken}
									duration={job?.input?.duration}
									version={job.updated_at}
								/>
							)}
							<div className="flex flex-col min-w-0">
								{job ? (
									<div className="flex flex-col min-w-0">
										<h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">{filename}</h3>
										<p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{job?.key}</p>
										{specs.length > 0 && (
											<span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{specs.join(", ")}</span>
										)}
									</div>
								) : (
									<h3 className="text-xl font-bold text-gray-900 dark:text-white">Loading...</h3>
								)}
							</div>
						</div>
						<div className="flex items-center gap-3">
							{/* Status Badge */}
							{job && (
								<Label
									status={job.status}
									size="lg"
									hidden="sm">
									{job.status}
								</Label>
							)}
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
						<nav className="flex px-6 gap-8 overflow-x-auto">
							{tabs.map((tab) => (
								<NavLink
									key={tab.path}
									to={tab.path}
									className={({ isActive }: { isActive: boolean }) =>
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
						) : (
							<Outlet context={{ job: job }} />
						)}
					</div>
				</div>
			</div>
		</div>
	);

	return createPortal(ModalContent, document.body);
};

export default JobDetailModal;
