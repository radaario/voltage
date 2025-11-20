import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Login from "@/components/pages/Login/Login";
import Jobs from "@/components/pages/Jobs/Jobs";
import Instances from "@/components/pages/Instances/Instances";
import Logs from "@/components/pages/Logs/Logs";
import LogDetailModal from "@/components/modals/LogDetailModal/LogDetailModal";
import LogInfoTab from "@/components/modals/LogDetailModal/tabs/InfoTab";
import MetadataTab from "@/components/modals/LogDetailModal/tabs/MetadataTab";
import Notifications from "@/components/pages/Notifications/Notifications";
import JobDetailModal from "@/components/modals/JobDetailModal/JobDetailModal";
import InstanceDetailModal from "@/components/modals/InstanceDetailModal/InstanceDetailModal";
import InstanceInfoTab from "@/components/modals/InstanceDetailModal/tabs/InfoTab";
import InstanceWorkersTab from "@/components/modals/InstanceDetailModal/tabs/WorkersTab";
import InstanceOutcomeTab from "@/components/modals/InstanceDetailModal/tabs/InstanceOutcomeTab";
import WorkerDetailModal from "@/components/modals/WorkerDetailModal/WorkerDetailModal";
import WorkerInfoTab from "@/components/modals/WorkerDetailModal/tabs/InfoTab";
import WorkerOutcomeTab from "@/components/modals/WorkerDetailModal/tabs/WorkerOutcomeTab";
import NotificationDetailModal from "@/components/modals/NotificationDetailModal/NotificationDetailModal";
import JobInfoTab from "@/components/modals/JobDetailModal/tabs/InfoTab";
import JobInputTab from "@/components/modals/JobDetailModal/tabs/InputTab";
import JobOutputsTab from "@/components/modals/JobDetailModal/tabs/OutputsTab";
import JobOutcomeTab from "@/components/modals/JobDetailModal/tabs/OutcomeTab";
import JobLogsTab from "@/components/modals/JobDetailModal/tabs/LogsTab";
import NotificationsTab from "@/components/modals/JobDetailModal/tabs/NotificationsTab";
import NotificationInfoTab from "@/components/modals/NotificationDetailModal/tabs/InfoTab";
import NotificationSpecsTab from "@/components/modals/NotificationDetailModal/tabs/SpecsTab";
import NotificationPayloadTab from "@/components/modals/NotificationDetailModal/tabs/PayloadTab";
import NotificationOutcomeTab from "@/components/modals/NotificationDetailModal/tabs/NotificationOutcomeTab";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import ScreenLoading from "@/components/composite/ScreenLoading/ScreenLoading";

const AuthSafeRoute = () => {
	const { isAuthenticated } = useAuth();
	const { config, configLoading } = useGlobalStateContext();

	// Config yüklenene kadar bekle
	if (configLoading) {
		return <ScreenLoading />;
	}

	// Authentication gerekli değilse direkt içeri al
	if (!config?.frontend?.is_authentication_required) {
		return <Outlet />;
	}

	// Authentication gerekli ve kullanıcı giriş yapmamışsa login'e yönlendir
	if (!isAuthenticated) {
		return (
			<Navigate
				to="/login"
				replace
			/>
		);
	}

	return <Outlet />;
};

const AuthRedirect = () => {
	const { isAuthenticated } = useAuth();
	const { config, configLoading } = useGlobalStateContext();

	// Config yüklenene kadar bekle
	if (configLoading) {
		return <ScreenLoading />;
	}

	// Authentication gerekli değilse direkt dashboard'a yönlendir
	if (!config?.frontend?.is_authentication_required) {
		return (
			<Navigate
				to="/"
				replace
			/>
		);
	}

	// Authentication gerekli ve kullanıcı giriş yapmışsa dashboard'a yönlendir
	if (isAuthenticated) {
		return (
			<Navigate
				to="/"
				replace
			/>
		);
	}

	return <Login />;
};

export const router = createBrowserRouter(
	[
		{ path: "/login", element: <AuthRedirect /> },
		{
			path: "/",
			element: <AuthSafeRoute />,
			children: [
				{
					path: "/",
					element: <Layout />,
					children: [
						{
							path: "",
							element: (
								<Navigate
									to="/jobs"
									replace
								/>
							)
						},
						{
							path: "jobs",
							element: <Jobs />,
							children: [
								{
									path: ":jobKey",
									element: <JobDetailModal />,
									children: [
										{
											path: "",
											element: (
												<Navigate
													to="info"
													replace
												/>
											)
										},
										{ path: "info", element: <JobInfoTab /> },
										{ path: "input", element: <JobInputTab /> },
										{ path: "outputs", element: <JobOutputsTab /> },
										{ path: "outcome", element: <JobOutcomeTab /> },
										{ path: "logs", element: <JobLogsTab /> },
										{ path: "notifications", element: <NotificationsTab /> }
									]
								}
							]
						},
						{
							path: "instances",
							element: <Instances />,
							children: [
								{
									path: ":instanceKey",
									element: <InstanceDetailModal />,
									children: [
										{
											path: "",
											element: (
												<Navigate
													to="info"
													replace
												/>
											)
										},
										{ path: "info", element: <InstanceInfoTab /> },
										{ path: "workers", element: <InstanceWorkersTab /> },
										{ path: "specs", element: <InstanceOutcomeTab /> }
									]
								},
								{
									path: "workers/:workerKey",
									element: <WorkerDetailModal />,
									children: [
										{
											path: "",
											element: (
												<Navigate
													to="info"
													replace
												/>
											)
										},
										{ path: "info", element: <WorkerInfoTab /> },
										{ path: "outcome", element: <WorkerOutcomeTab /> }
									]
								}
							]
						},
						{
							path: "logs",
							element: <Logs />,
							children: [
								{
									path: ":logKey",
									element: <LogDetailModal />,
									children: [
										{
											path: "",
											element: (
												<Navigate
													to="info"
													replace
												/>
											)
										},
										{ path: "info", element: <LogInfoTab /> },
										{ path: "metadata", element: <MetadataTab /> }
									]
								}
							]
						},
						{
							path: "notifications",
							element: <Notifications />,
							children: [
								{
									path: ":notificationKey",
									element: <NotificationDetailModal />,
									children: [
										{
											path: "",
											element: (
												<Navigate
													to="info"
													replace
												/>
											)
										},
										{ path: "info", element: <NotificationInfoTab /> },
										{ path: "specs", element: <NotificationSpecsTab /> },
										{ path: "payload", element: <NotificationPayloadTab /> },
										{ path: "outcome", element: <NotificationOutcomeTab /> }
									]
								}
							]
						}
					]
				}
			]
		}
	],
	{
		basename: import.meta.env.VITE_PATH !== "/" ? import.meta.env.VITE_PATH || "" : ""
	}
);
