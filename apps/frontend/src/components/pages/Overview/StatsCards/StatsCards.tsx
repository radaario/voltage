import React from "react";
import { ArrowDownTrayIcon, ArrowUpTrayIcon, BellIcon, RectangleStackIcon } from "@heroicons/react/24/outline";
import Card from "./Card/Card";

interface StatsCardsProps {
	aggregates: {
		jobs_completed_count: number;
		jobs_recieved_count: number;
		jobs_failed_count: number;
		inputs_completed_count: number;
		inputs_recieved_count: number;
		inputs_failed_count: number;
		outputs_completed_count: number;
		outputs_requested_count: number;
		outputs_failed_count: number;
		notifications_sent_count: number;
		notifications_failed_count: number;
	};
}

const StatsCards: React.FC<StatsCardsProps> = ({ aggregates }) => {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{/* Jobs Card */}
			<Card
				title="Jobs"
				icon={<RectangleStackIcon className="h-6 w-6" />}
				mainValue={aggregates.jobs_completed_count}
				secondaryText={`${aggregates.jobs_recieved_count.toLocaleString()} requested`}
				failedCount={aggregates.jobs_failed_count}
				to="/jobs"
			/>

			{/* Inputs Card */}
			<Card
				title="Inputs"
				icon={<ArrowDownTrayIcon className="h-6 w-6" />}
				mainValue={aggregates.inputs_completed_count}
				secondaryText={`${aggregates.inputs_recieved_count.toLocaleString()} requested`}
				failedCount={aggregates.inputs_failed_count}
			/>

			{/* Outputs Card */}
			<Card
				title="Outputs"
				icon={<ArrowUpTrayIcon className="h-6 w-6" />}
				mainValue={aggregates.outputs_completed_count}
				secondaryText={`${aggregates.outputs_requested_count.toLocaleString()} requested`}
				failedCount={aggregates.outputs_failed_count}
			/>

			{/* Notifications Card */}
			<Card
				title="Notifications"
				icon={<BellIcon className="h-6 w-6" />}
				mainValue={aggregates.notifications_sent_count}
				secondaryText={`${(aggregates.notifications_sent_count + aggregates.notifications_failed_count).toLocaleString()} requested`}
				failedCount={aggregates.notifications_failed_count}
				to="/notifications"
			/>
		</div>
	);
};

export default StatsCards;
