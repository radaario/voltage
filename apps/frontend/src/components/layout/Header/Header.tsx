import { useTheme } from "@/contexts/ThemeContext";
import {
	SunIcon,
	MoonIcon,
	ArrowRightStartOnRectangleIcon,
	RectangleStackIcon,
	BellIcon,
	ServerIcon,
	DocumentTextIcon,
	ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import { NavLink } from "react-router-dom";
import Logo from "@/components/base/Logo/Logo";
import Button from "@/components/base/Button/Button";
import Tooltip from "@/components/base/Tooltip/Tooltip";

function Header() {
	const { theme, toggleTheme } = useTheme();
	const { isAuthenticated, logout } = useAuth();
	const { config, configError, refetchConfig } = useGlobalStateContext();

	const showLogout = isAuthenticated && config?.frontend?.is_authentication_required;

	return (
		<header className="layout-header">
			<div className="flex items-center">
				<Logo size="md" />
			</div>
			{isAuthenticated && (
				<nav className="hidden md:flex items-center gap-3">
					<NavLink
						to="/jobs"
						className={({ isActive }: { isActive: boolean }) =>
							`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
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
						className={({ isActive }: { isActive: boolean }) =>
							`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
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
						className={({ isActive }: { isActive: boolean }) =>
							`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
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
						className={({ isActive }: { isActive: boolean }) =>
							`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
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
			<div className="flex items-center space-x-2">
				{/* Server Error Alert */}
				{configError && (
					<>
						<Tooltip content="Server not responding. Click to retry.">
							<Button
								variant="outline-danger"
								size="md"
								iconOnly
								onClick={refetchConfig}>
								<ExclamationTriangleIcon className="w-5 h-5" />
							</Button>
						</Tooltip>
						<div className="h-6 w-px bg-gray-200 dark:bg-gray-600 mx-2"></div>
					</>
				)}

				<Tooltip content={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
					<Button
						variant="soft"
						size="md"
						iconOnly
						onClick={toggleTheme}>
						{theme === "light" ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
					</Button>
				</Tooltip>
				{showLogout && (
					<>
						<div className="h-6 w-px bg-gray-200 dark:bg-neutral-700 mx-2"></div>
						<Tooltip content="Sign Out">
							<Button
								variant="soft"
								size="md"
								iconOnly
								onClick={logout}>
								<ArrowRightStartOnRectangleIcon className="w-5 h-5" />
							</Button>
						</Tooltip>
					</>
				)}
			</div>
		</header>
	);
}

export default Header;
