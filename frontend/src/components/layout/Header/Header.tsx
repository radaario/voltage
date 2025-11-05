import { useTheme } from "@/contexts/ThemeContext";
import { SunIcon, MoonIcon, ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import { NavLink } from "react-router-dom";
import Logo from "@/components/base/Logo/Logo";

function Header() {
	const { theme, toggleTheme } = useTheme();
	const { isAuthenticated, logout } = useAuth();
	const { config } = useGlobalStateContext();

	const showLogout = isAuthenticated && config?.dashboard?.is_authentication_required;

	return (
		<header className="layout-header">
			<div className="flex items-center">
				<Logo size="md" />
			</div>
			{isAuthenticated && (
				<nav className="hidden md:flex items-center gap-3">
					<NavLink
						to="/jobs"
						className={({ isActive }) =>
							`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
								isActive
									? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
									: "text-gray-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-gray-900 dark:hover:text-white"
							}`
						}>
						Jobs
					</NavLink>
					<NavLink
						to="/instances"
						className={({ isActive }) =>
							`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
								isActive
									? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
									: "text-gray-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-gray-900 dark:hover:text-white"
							}`
						}>
						Instances
					</NavLink>
					<NavLink
						to="/logs"
						className={({ isActive }) =>
							`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
								isActive
									? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
									: "text-gray-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-gray-900 dark:hover:text-white"
							}`
						}>
						Logs
					</NavLink>
					<NavLink
						to="/notifications"
						className={({ isActive }) =>
							`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
								isActive
									? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
									: "text-gray-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-gray-900 dark:hover:text-white"
							}`
						}>
						Notifications
					</NavLink>
				</nav>
			)}
			<div className="flex items-center space-x-2">
				<button
					className="p-2 rounded bg-dark-background-tertiary dark:bg-dark-background-tertiary text-dark-text-primary dark:text-dark-text-primary hover:bg-dark-background-primary dark:hover:bg-dark-background-primary hover:rounded-lg transition-all duration-300 cursor-pointer"
					onClick={toggleTheme}
					title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
					{theme === "light" ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
				</button>
				{showLogout && (
					<>
						<div className="h-6 w-px bg-gray-200 dark:bg-gray-600 mx-2"></div>
						<button
							className="p-2 rounded bg-dark-background-tertiary dark:bg-dark-background-tertiary text-dark-text-primary dark:text-dark-text-primary hover:bg-dark-background-primary dark:hover:bg-dark-background-primary hover:rounded-lg transition-all duration-300 cursor-pointer"
							title="Sign Out"
							onClick={logout}>
							<ArrowRightStartOnRectangleIcon className="w-5 h-5" />
						</button>
					</>
				)}
			</div>
		</header>
	);
}

export default Header;
