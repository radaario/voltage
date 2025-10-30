import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Login from "@/components/pages/Login/Login";
import Jobs from "@/components/pages/Jobs/Jobs";
import Instances from "@/components/pages/Instances/Instances";
import Logs from "@/components/pages/Logs/Logs";
import JobDetailModal from "@/components/modals/JobDetailModal/JobDetailModal";
import InstanceDetailModal from "@/components/modals/InstanceDetailModal/InstanceDetailModal";
import JobTab from "@/components/modals/JobDetailModal/tabs/JobTab";
import InputTab from "@/components/modals/JobDetailModal/tabs/InputTab";
import OutputsTab from "@/components/modals/JobDetailModal/tabs/OutputsTab";
import LogsTab from "@/components/modals/JobDetailModal/tabs/LogsTab";
import NotificationsTab from "@/components/modals/JobDetailModal/tabs/NotificationsTab";
import { useAuth } from "@/hooks/useAuth";

const AuthSafeRoute = () => {
	const { isAuthenticated } = useAuth();

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
								element: <InstanceDetailModal />
							}
						]
					},
					{ path: "logs", element: <Logs /> }
				]
			}
		]
	}
]);
