import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Login from "@/components/pages/Login/Login";
import Jobs from "@/components/pages/Jobs/Jobs";
import Instances from "@/components/pages/Instances/Instances";
import Logs from "@/components/pages/Logs/Logs";
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
					{ path: "jobs", element: <Jobs /> },
					{ path: "instances", element: <Instances /> },
					{ path: "logs", element: <Logs /> }
				]
			}
		]
	}
]);
