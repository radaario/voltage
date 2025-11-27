import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";

import Layout from "@/components/layout/Layout";
import { ScreenLoading } from "@/components";

import LoginPage from "@/components/pages/Login/Login";
import OverviewPage from "@/components/pages/Overview/Overview";
import JobsPage from "@/components/pages/Jobs/Jobs";
import InstancesPage from "@/components/pages/Instances/Instances";
import LogsPage from "@/components/pages/Logs/Logs";
import NotificationsPage from "@/components/pages/Notifications/Notifications";
import LogDetailModal from "@/components/modals/LogDetailModal/LogDetailModal";
import LogInfoTab from "@/components/modals/LogDetailModal/tabs/InfoTab";
import MetadataTab from "@/components/modals/LogDetailModal/tabs/MetadataTab";
import JobDetailModal from "@/components/modals/JobDetailModal/JobDetailModal";
import InstanceDetailModal from "@/components/modals/InstanceDetailModal/InstanceDetailModal";
import InstanceInfoTab from "@/components/modals/InstanceDetailModal/tabs/InfoTab";
import InstanceWorkersTab from "@/components/modals/InstanceDetailModal/tabs/WorkersTab";
import InstanceLogsTab from "@/components/modals/InstanceDetailModal/tabs/LogsTab";
import InstanceSpecsTab from "@/components/modals/InstanceDetailModal/tabs/InstanceOutcomeTab";
import InstanceOutcomeTab from "@/components/modals/InstanceDetailModal/tabs/OutcomeTab";
import WorkerDetailModal from "@/components/modals/WorkerDetailModal/WorkerDetailModal";
import WorkerInfoTab from "@/components/modals/WorkerDetailModal/tabs/InfoTab";
import WorkerOutcomeTab from "@/components/modals/WorkerDetailModal/tabs/WorkerOutcomeTab";
import WorkerLogsTab from "@/components/modals/WorkerDetailModal/tabs/LogsTab";
import NotificationDetailModal from "@/components/modals/NotificationDetailModal/NotificationDetailModal";
import JobInfoTab from "@/components/modals/JobDetailModal/tabs/InfoTab";
import JobInputTab from "@/components/modals/JobDetailModal/tabs/InputTab";
import JobOutputsTab from "@/components/modals/JobDetailModal/tabs/OutputsTab";
import JobOutcomeTab from "@/components/modals/JobDetailModal/tabs/OutcomeTab";
import JobLogsTab from "@/components/modals/JobDetailModal/tabs/LogsTab";
import NotificationsTab from "@/components/modals/JobDetailModal/tabs/NotificationsTab";
import OutputDetailModal from "@/components/modals/OutputDetailModal/OutputDetailModal";
import OutputInfoTab from "@/components/modals/OutputDetailModal/tabs/InfoTab";
import OutputSpecsTab from "@/components/modals/OutputDetailModal/tabs/SpecsTab";
import OutputOutcomeTab from "@/components/modals/OutputDetailModal/tabs/OutcomeTab";
import NotificationInfoTab from "@/components/modals/NotificationDetailModal/tabs/InfoTab";
import NotificationSpecsTab from "@/components/modals/NotificationDetailModal/tabs/SpecsTab";
import NotificationPayloadTab from "@/components/modals/NotificationDetailModal/tabs/PayloadTab";
import NotificationOutcomeTab from "@/components/modals/NotificationDetailModal/tabs/NotificationOutcomeTab";

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

	return <LoginPage />;
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
														{ path: "outcome", element: <OutputOutcomeTab /> }
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
