import { useTheme } from "@/contexts/ThemeContext";
import { SunIcon, MoonIcon, ArrowPathIcon, CodeBracketIcon, ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { APP } from "@/constants";

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
					className="select-none leading-none text-2xl sm:text-3xl font-black tracking-wider uppercase bg-linear-to-r from-emerald-500 via-green-500 to-lime-500 dark:from-emerald-300 dark:via-green-300 dark:to-lime-300 text-transparent bg-clip-text drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
					aria-label="Voltage logo text">
					{APP.NAME}
				</h2>
			</div>
			<div className="flex items-center space-x-2">
				<button
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
