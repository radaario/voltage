import React, { ReactNode } from "react";
import { NavLink } from "react-router-dom";

export interface CardProps {
	title: string;
	icon: ReactNode;
	mainValue: number;
	secondaryText: string;
	failedCount?: number;
	to?: string;
}

const Card: React.FC<CardProps> = ({ title, icon, mainValue, secondaryText, failedCount, to }) => {
	const content = (
		<>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 sm:gap-3">
					<div className="rounded-lg bg-gray-100 dark:bg-neutral-700 p-2">{icon}</div>
					<div>
						<p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
					</div>
				</div>
			</div>
			<div className="mt-2 flex items-baseline gap-2 text-gray-900 dark:text-white">
				<p className="text-3xl font-bold">{mainValue.toLocaleString()}</p>
			</div>
			<div className="mt-2 flex flex-wrap items-baseline gap-2 text-xs text-gray-500 dark:text-white">
				<p>{secondaryText}</p>
				{failedCount !== undefined && failedCount > 0 && (
					<p className="text-red-600 dark:text-red-400">({failedCount.toLocaleString()} failed)</p>
				)}
			</div>
		</>
	);

	const baseClassName =
		"rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 sm:p-5 shadow-sm transition-all hover:shadow-md";

	if (to) {
		return (
			<NavLink
				to={to}
				title={`Go to ${title}`}
				className={`${baseClassName} hover:bg-neutral-100/50 dark:hover:bg-neutral-700/50`}>
				{content}
			</NavLink>
		);
	}

	return <div className={baseClassName}>{content}</div>;
};

export default Card;
