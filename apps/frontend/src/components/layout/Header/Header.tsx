import { useTheme } from "@/contexts/ThemeContext";
import {
	SunIcon,
	MoonIcon,
	ArrowRightStartOnRectangleIcon,
	RectangleStackIcon,
	BellIcon,
	ServerIcon,
	DocumentTextIcon,
	ExclamationTriangleIcon,
	Bars3Icon,
	XMarkIcon,
	PresentationChartLineIcon,
	TrashIcon,
	InformationCircleIcon
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import { NavLink } from "react-router-dom";
import { Logo, Button, Tooltip, ConfirmModal, ConfigModal } from "@/components";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/utils";

function Header() {
	const { theme, toggleTheme } = useTheme();
	const { isAuthenticated, logout, authToken } = useAuth();
	const { config, configError, refetchConfig, resetPage } = useGlobalStateContext();
	const queryClient = useQueryClient();

	// states
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const [showFactoryResetModal, setShowFactoryResetModal] = useState(false);
	const [showConfigModal, setShowConfigModal] = useState(false);

	// data
	const showLogout = isAuthenticated && config?.frontend?.is_authentication_required;

	// mutations
	const factoryResetMutation = useMutation({
		mutationFn: async () => {
			return await api.delete("/all", { token: authToken });
		},
		onSuccess: async () => {
			setShowFactoryResetModal(false);
			// Invalidate all queries to refresh data
			await queryClient.invalidateQueries();
		}
	});

	// actions
	const handleNavClick = () => {
		setIsMobileMenuOpen(false);
	};

	const handleFactoryReset = () => {
		setShowFactoryResetModal(true);
	};

	const handleConfirmFactoryReset = () => {
		factoryResetMutation.mutate();
	};

	const handleCloseFactoryResetModal = () => {
		if (!factoryResetMutation.isPending) {
			setShowFactoryResetModal(false);
		}
	};

	return (
		<>
			<header className="layout-header">
				<div className="flex items-center">
					<Logo
						variant={theme === "dark" ? "light" : "dark"}
						size="md"
					/>
				</div>
				{isAuthenticated && (
					<nav className="hidden lg:flex items-center gap-3 ml-2">
						<NavLink
							to="/"
							onClick={resetPage}
							className={({ isActive }: { isActive: boolean }) =>
								`flex items-center gap-2 px-4 xl:px-6 py-2 xl:py-2.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-200 ${
									isActive
										? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
										: "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700 hover:text-gray-900 dark:hover:text-white"
								}`
							}>
							<PresentationChartLineIcon className="h-4 w-4" />
							Overview
						</NavLink>
						<NavLink
							to="/jobs"
							onClick={resetPage}
							className={({ isActive }: { isActive: boolean }) =>
								`flex items-center gap-2 px-4 xl:px-6 py-2 xl:py-2.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-200 ${
									isActive
										? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
										: "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700 hover:text-gray-900 dark:hover:text-white"
								}`
							}>
							<RectangleStackIcon className="h-4 w-4" />
							Jobs
						</NavLink>
						<NavLink
							to="/notifications"
							onClick={resetPage}
							className={({ isActive }: { isActive: boolean }) =>
								`flex items-center gap-2 px-4 xl:px-6 py-2 xl:py-2.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-200 ${
									isActive
										? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
										: "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700 hover:text-gray-900 dark:hover:text-white"
								}`
							}>
							<BellIcon className="h-4 w-4" />
							Notifications
						</NavLink>
						<NavLink
							to="/instances"
							onClick={resetPage}
							className={({ isActive }: { isActive: boolean }) =>
								`flex items-center gap-2 px-4 xl:px-6 py-2 xl:py-2.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-200 ${
									isActive
										? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
										: "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700 hover:text-gray-900 dark:hover:text-white"
								}`
							}>
							<ServerIcon className="h-4 w-4" />
							Instances
						</NavLink>
						<NavLink
							to="/logs"
							onClick={resetPage}
							className={({ isActive }: { isActive: boolean }) =>
								`flex items-center gap-2 px-4 xl:px-6 py-2 xl:py-2.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-200 ${
									isActive
										? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
										: "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700 hover:text-gray-900 dark:hover:text-white"
								}`
							}>
							<DocumentTextIcon className="h-4 w-4" />
							Logs
						</NavLink>
					</nav>
				)}
				<div className="flex items-center gap-1">
					{/* Mobile Menu Button */}
					{isAuthenticated && (
						<Button
							variant="soft"
							size="md"
							iconOnly
							className="lg:hidden -mr-3"
							onClick={() => setIsMobileMenuOpen(true)}>
							<Bars3Icon className="w-8 h-8" />
						</Button>
					)}

					<Tooltip content={`${theme === "light" ? "Dark" : "Light"} Mode`}>
						<Button
							variant="soft"
							size="md"
							iconOnly
							className="hidden lg:flex"
							onClick={toggleTheme}>
							{theme === "light" ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
						</Button>
					</Tooltip>

					{isAuthenticated && (
						<>
							<div className="h-6 w-px bg-gray-200 dark:bg-neutral-700 mx-2 hidden lg:block"></div>
							<Tooltip content="Delete All Data">
								<Button
									variant="soft"
									hover="text-danger"
									size="md"
									iconOnly
									className="hidden lg:flex"
									onClick={handleFactoryReset}
									disabled={factoryResetMutation.isPending}
									isLoading={factoryResetMutation.isPending}>
									<TrashIcon className="w-5 h-5" />
								</Button>
							</Tooltip>
						</>
					)}

					{/* Server Error Alert */}
					{configError ? (
						<>
							<div className="h-6 w-px bg-gray-200 dark:bg-neutral-700 mx-2 hidden lg:block"></div>
							<Tooltip content="Server not responding. Click to retry.">
								<Button
									variant="outline-danger"
									size="md"
									iconOnly
									onClick={refetchConfig}>
									<ExclamationTriangleIcon className="w-5 h-5" />
								</Button>
							</Tooltip>
						</>
					) : (
						isAuthenticated && (
							<>
								<div className="h-6 w-px bg-gray-200 dark:bg-neutral-700 mx-2 hidden lg:block"></div>
								<Tooltip content={`Configuration`}>
									<Button
										variant="soft"
										size="md"
										iconOnly
										className="hidden lg:flex"
										onClick={() => setShowConfigModal(true)}>
										<InformationCircleIcon className="w-5 h-5" />
										<span className="text-sm">v{config && config.version}</span>
									</Button>
								</Tooltip>
							</>
						)
					)}

					{/* Logout */}
					{showLogout && (
						<>
							<div className="h-6 w-px bg-gray-200 dark:bg-neutral-700 mx-2 hidden lg:block"></div>
							<Tooltip content="Sign Out">
								<Button
									variant="soft"
									size="md"
									iconOnly
									className="hidden lg:flex"
									onClick={logout}>
									<ArrowRightStartOnRectangleIcon className="w-5 h-5" />
								</Button>
							</Tooltip>
						</>
					)}
				</div>
			</header>

			{/* Mobile Menu Overlay */}
			{isMobileMenuOpen && (
				<div
					className="fixed inset-0 z-50 md:hidden"
					onClick={() => setIsMobileMenuOpen(false)}>
					{/* Backdrop */}
					<div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

					{/* Menu Panel */}
					<div
						className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-white dark:bg-neutral-800 shadow-2xl flex flex-col"
						onClick={(e) => e.stopPropagation()}>
						{/* Header */}
						<div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-700">
							<h2 className="text-lg font-bold text-gray-900 dark:text-white">Menu</h2>
							<Button
								variant="soft"
								size="md"
								iconOnly
								onClick={() => setIsMobileMenuOpen(false)}>
								<XMarkIcon className="w-6 h-6" />
							</Button>
						</div>

						{/* Navigation Links */}
						<nav className="flex flex-col p-4 space-y-2 overflow-y-auto flex-1">
							<NavLink
								to="/"
								onClick={handleNavClick}
								className={({ isActive }: { isActive: boolean }) =>
									`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all duration-200 ${
										isActive
											? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
											: "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-gray-900 dark:hover:text-white"
									}`
								}>
								<PresentationChartLineIcon className="h-5 w-5" />
								Overview
							</NavLink>
							<NavLink
								to="/jobs"
								onClick={handleNavClick}
								className={({ isActive }: { isActive: boolean }) =>
									`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all duration-200 ${
										isActive
											? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
											: "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-gray-900 dark:hover:text-white"
									}`
								}>
								<RectangleStackIcon className="h-5 w-5" />
								Jobs
							</NavLink>
							<NavLink
								to="/notifications"
								onClick={handleNavClick}
								className={({ isActive }: { isActive: boolean }) =>
									`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all duration-200 ${
										isActive
											? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
											: "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-gray-900 dark:hover:text-white"
									}`
								}>
								<BellIcon className="h-5 w-5" />
								Notifications
							</NavLink>
							<NavLink
								to="/instances"
								onClick={handleNavClick}
								className={({ isActive }: { isActive: boolean }) =>
									`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all duration-200 ${
										isActive
											? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
											: "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-gray-900 dark:hover:text-white"
									}`
								}>
								<ServerIcon className="h-5 w-5" />
								Instances
							</NavLink>
							<NavLink
								to="/logs"
								onClick={handleNavClick}
								className={({ isActive }: { isActive: boolean }) =>
									`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all duration-200 ${
										isActive
											? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
											: "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-gray-900 dark:hover:text-white"
									}`
								}>
								<DocumentTextIcon className="h-5 w-5" />
								Logs
							</NavLink>
						</nav>

						{/* Actions Section */}
						<div className="px-4 py-6 mt-auto border-t border-gray-200 dark:border-neutral-700">
							<div className="flex flex-col space-y-2">
								{/* Server Error Alert */}
								{configError ? (
									<Button
										variant="outline-danger"
										size="sm"
										className="w-full justify-between"
										onClick={refetchConfig}>
										<ExclamationTriangleIcon className="w-5 h-5" />
										Refresh Server
									</Button>
								) : (
									isAuthenticated && (
										<Button
											variant="ghost"
											size="sm"
											className="w-full border border-gray-200 dark:border-neutral-600 justify-between"
											onClick={() => setShowConfigModal(true)}>
											<InformationCircleIcon className="w-5 h-5 order-2" />
											<span className="text-sm">v{config && config.version}</span>
										</Button>
									)
								)}

								<Button
									variant="soft"
									size="sm"
									onClick={toggleTheme}
									className="w-full justify-between">
									{theme === "light" ? <MoonIcon className="order-2 w-5 h-5" /> : <SunIcon className="order-2 w-5 h-5" />}
									{theme === "light" ? "Dark" : "Light"} Mode
								</Button>

								<Button
									variant="soft"
									hover="text-danger"
									size="sm"
									onClick={() => {
										setIsMobileMenuOpen(false);
										handleFactoryReset();
									}}
									disabled={factoryResetMutation.isPending}
									isLoading={factoryResetMutation.isPending}
									className="w-full justify-between">
									<TrashIcon className="order-2 w-5 h-5" />
									Delete All Data
								</Button>

								{showLogout && (
									<Button
										variant="soft"
										size="sm"
										onClick={() => {
											setIsMobileMenuOpen(false);
											logout();
										}}
										className="w-full justify-between">
										<ArrowRightStartOnRectangleIcon className="order-2 w-5 h-5" />
										Sign Out
									</Button>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Factory Reset Confirmation Modal */}
			{showFactoryResetModal && (
				<ConfirmModal
					isOpen={showFactoryResetModal}
					onClose={handleCloseFactoryResetModal}
					onConfirm={handleConfirmFactoryReset}
					title="Delete All Data"
					message={
						<>
							<p className="mb-4">
								Are you sure you want to delete <strong className="text-red-600 dark:text-red-400">all data</strong>? All
								data, including these, will be permanently deleted:
							</p>
							<ul className="list-disc list-inside space-y-1 mb-4 text-sm">
								<li>All Statistics</li>
								<li>All Logs</li>
								<li>All Instances & Workers</li>
								<li>All Jobs</li>
								<li>All Notifications</li>
							</ul>
							<p className="font-semibold text-red-600 dark:text-red-400">This action cannot be undone!</p>
						</>
					}
					confirmText="Delete Everything"
					variant="danger"
					isLoading={factoryResetMutation.isPending}
					loadingText="Deleting All Data"
				/>
			)}

			{/* Config Modal */}
			{showConfigModal && config && (
				<ConfigModal
					isOpen={showConfigModal}
					onClose={() => setShowConfigModal(false)}
					config={config}
				/>
			)}
		</>
	);
}
export default Header;
