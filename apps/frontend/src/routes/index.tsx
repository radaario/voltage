import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import { RouterErrorBoundary } from "@/components";

import Layout from "@/components/layout/Layout";
import { ScreenLoading } from "@/components";

import LoginPage from "@/components/pages/Login/Login";
import OverviewPage from "@/components/pages/Overview/Overview";
import JobsPage from "@/components/pages/Jobs/Jobs";
import InstancesPage from "@/components/pages/Instances/Instances";
import LogsPage from "@/components/pages/Logs/Logs";
import NotificationsPage from "@/components/pages/Notifications/Notifications";
import LogDetailModal from "@/components/modals/LogDetailModal/LogDetailModal";
import LogInfoTab from "@/components/modals/LogDetailModal/Tabs/Info";
import MetadataTab from "@/components/modals/LogDetailModal/Tabs/Metadata";
import JobDetailModal from "@/components/modals/JobDetailModal/JobDetailModal";
import InstanceDetailModal from "@/components/modals/InstanceDetailModal/InstanceDetailModal";
import InstanceInfoTab from "@/components/modals/InstanceDetailModal/Tabs/Info";
import InstanceWorkersTab from "@/components/modals/InstanceDetailModal/Tabs/Workers";
import InstanceLogsTab from "@/components/modals/InstanceDetailModal/Tabs/Logs";
import InstanceSpecsTab from "@/components/modals/InstanceDetailModal/Tabs/Specs";
import InstanceOutcomeTab from "@/components/modals/InstanceDetailModal/Tabs/Outcome";
import WorkerDetailModal from "@/components/modals/WorkerDetailModal/WorkerDetailModal";
import WorkerInfoTab from "@/components/modals/WorkerDetailModal/Tabs/Info";
import WorkerOutcomeTab from "@/components/modals/WorkerDetailModal/Tabs/Outcome";
import WorkerLogsTab from "@/components/modals/WorkerDetailModal/Tabs/Logs";
import NotificationDetailModal from "@/components/modals/NotificationDetailModal/NotificationDetailModal";
import JobInfoTab from "@/components/modals/JobDetailModal/Tabs/Info";
import JobInputTab from "@/components/modals/JobDetailModal/Tabs/Input";
import JobOutputsTab from "@/components/modals/JobDetailModal/Tabs/Outputs";
import JobOutcomeTab from "@/components/modals/JobDetailModal/Tabs/Outcome";
import JobLogsTab from "@/components/modals/JobDetailModal/Tabs/Logs";
import NotificationsTab from "@/components/modals/JobDetailModal/Tabs/Notifications";
import OutputDetailModal from "@/components/modals/OutputDetailModal/OutputDetailModal";
import OutputInfoTab from "@/components/modals/OutputDetailModal/Tabs/Info";
import OutputSpecsTab from "@/components/modals/OutputDetailModal/Tabs/Specs";
import OutputOutcomeTab from "@/components/modals/OutputDetailModal/Tabs/Outcome";
import OutputLogsTab from "@/components/modals/OutputDetailModal/Tabs/Logs";
import NotificationInfoTab from "@/components/modals/NotificationDetailModal/Tabs/Info";
import NotificationSpecsTab from "@/components/modals/NotificationDetailModal/Tabs/Specs";
import NotificationPayloadTab from "@/components/modals/NotificationDetailModal/Tabs/Payload";
import NotificationOutcomeTab from "@/components/modals/NotificationDetailModal/Tabs/Outcome";

const AuthSafeRoute = () => {
	const { isAuthenticated } = useAuth();
	const { config, configLoading } = useGlobalStateContext();

	// Wait until config is loaded
	if (configLoading) {
		return <ScreenLoading />;
	}

	// If authentication is not required, allow access directly
	if (!config?.frontend?.is_authentication_required) {
		return <Outlet />;
	}

	// If authentication is required and the user is not authenticated, redirect to login
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

	// Wait until config is loaded
	if (configLoading) {
		return <ScreenLoading />;
	}

	// If authentication is not required, redirect to dashboard
	if (!config?.frontend?.is_authentication_required) {
		return (
			<Navigate
				to="/"
				replace
			/>
		);
	}

	// If authentication is required and the user is authenticated, redirect to dashboard
	if (isAuthenticated) {
		return (
			<Navigate
				to="/"
				replace
			/>
		);
	}

	return <LoginPage />;
};

export const router = createBrowserRouter(
	[
		{ path: "/login", element: <AuthRedirect /> },
		{
			path: "/",
			element: <AuthSafeRoute />,
			errorElement: <RouterErrorBoundary />,
			children: [
				{
					path: "/",
					element: <Layout.Auth />,
					children: [
						{
							path: "",
							element: <OverviewPage />
						},
						{
							path: "jobs",
							element: <JobsPage />,
							children: [
								{
									path: ":jobKey/*",
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
										{
											path: "outputs",
											element: <JobOutputsTab />,
											children: [
												{
													path: ":outputKey",
													element: <OutputDetailModal />,
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
														{ path: "info", element: <OutputInfoTab /> },
														{ path: "specs", element: <OutputSpecsTab /> },
														{ path: "outcome", element: <OutputOutcomeTab /> },
														{
															path: "logs",
															element: <OutputLogsTab />,
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
														}
													]
												}
											]
										},
										{ path: "outcome", element: <JobOutcomeTab /> },
										{
											path: "logs",
											element: <JobLogsTab />,
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
											element: <NotificationsTab />,
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
						},
						{
							path: "instances",
							element: <InstancesPage />,
							children: [
								// Standalone worker route (without instance modal)
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
										{ path: "outcome", element: <WorkerOutcomeTab /> },
										{
											path: "logs",
											element: <WorkerLogsTab />,
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
										}
									]
								},
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
										{
											path: "workers",
											element: <InstanceWorkersTab />,
											children: [
												{
													path: ":workerKey",
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
														{ path: "outcome", element: <WorkerOutcomeTab /> },
														{
															path: "logs",
															element: <WorkerLogsTab />,
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
														}
													]
												}
											]
										},
										{
											path: "logs",
											element: <InstanceLogsTab />,
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
										{ path: "specs", element: <InstanceSpecsTab /> },
										{ path: "outcome", element: <InstanceOutcomeTab /> }
									]
								}
							]
						},
						{
							path: "logs",
							element: <LogsPage />,
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
							element: <NotificationsPage />,
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
						},
						// Catch-all route for 404s
						{
							path: "*",
							element: (
								<Navigate
									to="/"
									replace
								/>
							)
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
