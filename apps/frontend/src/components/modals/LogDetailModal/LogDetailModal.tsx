import { Outlet, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DocumentTextIcon, InformationCircleIcon, CircleStackIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { useRouteModal } from "@/hooks/useRouteModal";
import type { Log } from "@/interfaces/log";
import { Modal, Label, Button, Tooltip, TabsNavigation, LoadingSpinner } from "@/components";
import { api, ApiResponse } from "@/utils";
import { useMemo } from "react";

const LogDetailModal: React.FC = () => {
	const { jobKey, logKey, instanceKey, workerKey, outputKey } = useParams<{
		logKey: string;
		jobKey?: string;
		instanceKey?: string;
		workerKey?: string;
		outputKey?: string;
	}>();
	const { authToken } = useAuth();

	// states (computed from route params)
	const navigateBackTo = useMemo(() => {
		if (workerKey) {
			return `/instances/workers/${workerKey}/logs`;
		}

		if (instanceKey) {
			if (workerKey) {
				return `/instances/${instanceKey}/workers/${workerKey}/logs`;
			}

			return `/instances/${instanceKey}/logs`;
		}

		if (jobKey) {
			if (outputKey) {
				return `/jobs/${jobKey}/outputs/${outputKey}/logs`;
			}

			return `/jobs/${jobKey}/logs`;
		}

		return "/logs";
	}, [instanceKey, workerKey, jobKey, outputKey]);

	const modalId = instanceKey ? "InstanceLogDetailModal" : jobKey ? "JobLogDetailModal" : "LogDetailModal";

	const modalProps = useRouteModal({ navigateBackTo: navigateBackTo, id: modalId });

	// queries
	const {
		data: logResponse,
		isLoading,
		isError
	} = useQuery<ApiResponse<Log>>({
		queryKey: ["log", logKey],
		queryFn: () =>
			api.get<Log>("/logs", {
				token: authToken || "",
				log_key: logKey || ""
			}),
		enabled: !!logKey && !!authToken
	});

	// states (need query data)
	const log = logResponse?.data;

	const tabs = [
		{ path: "info", label: "Info", icon: InformationCircleIcon },
		{ path: "metadata", label: "Metadata", icon: CircleStackIcon }
	];

	return (
		<Modal
			{...modalProps}
			height="xl"
			size="5xl">
			{/* Header */}
			<Modal.Header
				onClose={modalProps.handleClose}
				showCloseButton={false}>
				<div className="flex items-start justify-between w-full">
					<div className="flex items-start gap-3 overflow-hidden min-w-0">
						<DocumentTextIcon className="h-7 w-7 text-gray-600 dark:text-gray-400 mt-0.5 shrink-0" />
						<div className="min-w-0">
							{log ? (
								<>
									<div className="flex items-center gap-3">
										<h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Log</h3>
										<Label status={log.type}>{log.type || "UNKNOWN"}</Label>
									</div>
									<p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono truncate">{log.key}</p>
								</>
							) : (
								<h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
									{isError ? "Failed to load log. The log may not exist." : "Loading..."}
								</h3>
							)}
						</div>
					</div>
					<div className="flex items-center gap-3 shrink-0 ml-4">
						<Tooltip content="Close">
							<Button
								variant="ghost"
								size="md"
								iconOnly
								onClick={modalProps.handleClose}>
								<XMarkIcon className="h-6 w-6" />
							</Button>
						</Tooltip>
					</div>
				</div>
			</Modal.Header>

			{/* Tabs Navigation */}
			<TabsNavigation tabs={tabs} />

			{/* Tab Content */}
			<Modal.Content
				noPadding
				className="h-[60vh]">
				<div className="p-6 h-full overflow-y-auto">
					{isLoading ? (
						<LoadingSpinner />
					) : isError || !log ? (
						<div className="flex flex-col justify-center items-center py-12 gap-3">
							<p className="text-sm text-gray-600 dark:text-gray-400">
								{isError ? "Failed to load log. The log may not exist." : "Log not found."}
							</p>
							<Button
								variant="secondary"
								size="sm"
								onClick={modalProps.handleClose}>
								Close
							</Button>
						</div>
					) : (
						<Outlet context={{ log: log }} />
					)}
				</div>
			</Modal.Content>
		</Modal>
	);
};

export default LogDetailModal;
