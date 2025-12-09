import { NavLink } from "react-router-dom";

interface Tab {
	path: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}

interface TabsNavigationProps {
	tabs: Tab[];
	className?: string;
}

const TabsNavigation: React.FC<TabsNavigationProps> = ({ tabs, className = "" }) => {
	return (
		<div className={`shrink-0 border-b border-gray-200 dark:border-neutral-700 ${className}`}>
			<nav className="flex overflow-x-auto px-6 gap-8">
				{tabs.map((tab) => (
					<NavLink
						key={tab.path}
						to={tab.path}
						className={({ isActive }) =>
							`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
								isActive
									? "border-neutral-700 text-gray-900 dark:border-neutral-400 dark:text-white"
									: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
							}`
						}>
						<tab.icon className="h-4 w-4" />
						{tab.label}
					</NavLink>
				))}
			</nav>
		</div>
	);
};

export default TabsNavigation;
