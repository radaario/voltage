import { useTheme } from "@/contexts/ThemeContext";
import { SunIcon, MoonIcon, ArrowPathIcon, CodeBracketIcon, ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { APP } from "@/constants";
import { NavLink } from "react-router-dom";

function Header() {
	const { theme, toggleTheme } = useTheme();
	const { isAuthenticated, logout } = useAuth();

	// actions
	const handleAllRefresh = (e: any) => {
		e.preventDefault();
		const confirmStatus = confirm("Are you sure about the all clear?");
		if (confirmStatus) {
			// socket.emit(SOCKET_EVENTS.CLIENT.SEND_CLEAR);
		}
	};

	return (
		<header className="layout-header">
			<div className="flex items-center">
				<h2
					className="select-none leading-none text-2xl sm:text-3xl font-black tracking-wider uppercase bg-neutral-700 dark:bg-white text-transparent bg-clip-text drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
					aria-label="Voltage logo text">
					{APP.NAME}
				</h2>
			</div>
			<nav className="hidden md:flex items-center space-x-1">
				<NavLink
					to="/jobs"
					className={({ isActive }) =>
						`px-3 py-2 rounded-md text-md font-medium transition-colors ${
							isActive
								? "bg-dark-background-primary text-indigo-700"
								: "text-dark-text-primary hover:bg-dark-background-primary"
						}`
					}>
					Jobs
				</NavLink>
				<NavLink
					to="/instances"
					className={({ isActive }) =>
						`px-3 py-2 rounded-md text-md font-medium transition-colors ${
							isActive
								? "bg-dark-background-primary text-indigo-700"
								: "text-dark-text-primary hover:bg-dark-background-primary"
						}`
					}>
					Instances & Workers
				</NavLink>
				<NavLink
					to="/logs"
					className={({ isActive }) =>
						`px-3 py-2 rounded-md text-md font-medium transition-colors ${
							isActive
								? "bg-dark-background-primary text-indigo-700"
								: "text-dark-text-primary hover:bg-dark-background-primary"
						}`
					}>
					Logs
				</NavLink>
			</nav>
			<div className="flex items-center space-x-2">
				<button
					role="button"
					className="p-2 rounded bg-dark-background-tertiary dark:bg-dark-background-tertiary text-dark-text-primary dark:text-dark-text-primary hover:bg-dark-background-primary dark:hover:bg-dark-background-primary hover:rounded-lg transition-all duration-300 cursor-pointer"
					title="All Refresh"
					onClick={handleAllRefresh}>
					<ArrowPathIcon className="w-5 h-5" />
				</button>
				<button
					className="p-2 rounded bg-dark-background-tertiary dark:bg-dark-background-tertiary text-dark-text-primary dark:text-dark-text-primary hover:bg-dark-background-primary dark:hover:bg-dark-background-primary hover:rounded-lg transition-all duration-300 cursor-pointer"
					title="JSON Prettier"
					onClick={() => null}>
					<CodeBracketIcon className="w-5 h-5" />
				</button>
				<button
					className="p-2 rounded bg-dark-background-tertiary dark:bg-dark-background-tertiary text-dark-text-primary dark:text-dark-text-primary hover:bg-dark-background-primary dark:hover:bg-dark-background-primary hover:rounded-lg transition-all duration-300 cursor-pointer"
					onClick={toggleTheme}
					title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
					{theme === "light" ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
				</button>
				{isAuthenticated && (
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
