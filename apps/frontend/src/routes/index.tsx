import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Login from "@/components/pages/Login/Login";
import Jobs from "@/components/pages/Jobs/Jobs";
import Instances from "@/components/pages/Instances/Instances";
import Logs from "@/components/pages/Logs/Logs";
import LogDetailModal from "@/components/modals/LogDetailModal/LogDetailModal";
import LogTab from "@/components/modals/LogDetailModal/tabs/LogTab";
import MetadataTab from "@/components/modals/LogDetailModal/tabs/MetadataTab";
import Notifications from "@/components/pages/Notifications/Notifications";
import JobDetailModal from "@/components/modals/JobDetailModal/JobDetailModal";
import InstanceDetailModal from "@/components/modals/InstanceDetailModal/InstanceDetailModal";
import InstanceTab from "@/components/modals/InstanceDetailModal/tabs/InstanceTab";
import InstanceWorkersTab from "@/components/modals/InstanceDetailModal/tabs/WorkersTab";
import InstanceOutcomeTab from "@/components/modals/InstanceDetailModal/tabs/InstanceOutcomeTab";
import WorkerDetailModal from "@/components/modals/WorkerDetailModal/WorkerDetailModal";
import WorkerTab from "@/components/modals/WorkerDetailModal/tabs/WorkerTab";
import WorkerOutcomeTab from "@/components/modals/WorkerDetailModal/tabs/WorkerOutcomeTab";
import NotificationDetailModal from "@/components/modals/NotificationDetailModal/NotificationDetailModal";
import JobTab from "@/components/modals/JobDetailModal/tabs/JobTab";
import InputTab from "@/components/modals/JobDetailModal/tabs/InputTab";
import OutputsTab from "@/components/modals/JobDetailModal/tabs/OutputsTab";
import OutcomeTab from "@/components/modals/JobDetailModal/tabs/OutcomeTab";
import LogsTab from "@/components/modals/JobDetailModal/tabs/LogsTab";
import NotificationsTab from "@/components/modals/JobDetailModal/tabs/NotificationsTab";
import NotificationTab from "@/components/modals/NotificationDetailModal/tabs/NotificationTab";
import PayloadTab from "@/components/modals/NotificationDetailModal/tabs/PayloadTab";
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
	if (!config?.dashboard?.is_authentication_required) {
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
	if (!config?.dashboard?.is_authentication_required) {
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

export const router = createBrowserRouter([
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
												to="job"
												replace
											/>
										)
									},
									{ path: "job", element: <JobTab /> },
									{ path: "input", element: <InputTab /> },
									{ path: "outputs", element: <OutputsTab /> },
									{ path: "outcome", element: <OutcomeTab /> },
									{ path: "logs", element: <LogsTab /> },
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
												to="instance"
												replace
											/>
										)
									},
									{ path: "instance", element: <InstanceTab /> },
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
												to="worker"
												replace
											/>
										)
									},
									{ path: "worker", element: <WorkerTab /> },
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
												to="log"
												replace
											/>
										)
									},
									{ path: "log", element: <LogTab /> },
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
												to="notification"
												replace
											/>
										)
									},
									{ path: "notification", element: <NotificationTab /> },
									{ path: "payload", element: <PayloadTab /> },
									{ path: "outcome", element: <NotificationOutcomeTab /> }
								]
							}
						]
					}
				]
			}
		]
	}
]);
