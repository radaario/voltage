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
		notifications_created_count: number;
		notifications_sent_count: number;
		notifications_retried_count: number;
		notifications_failed_count: number;
	};
}

const StatsCards: React.FC<StatsCardsProps> = ({ aggregates }) => {
	return (
		<div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
			{/* Jobs Card */}
			<Card
				title="Jobs"
				icon={<RectangleStackIcon className="h-4 w-4 sm:h-6 sm:w-6" />}
				mainValue={aggregates.jobs_completed_count || 0}
				secondaryText={`${(aggregates.jobs_recieved_count || 0).toLocaleString()} recieved`}
				failedCount={aggregates.jobs_failed_count || 0}
				to="/jobs"
			/>

			{/* Inputs Card */}
			<Card
				title="Inputs"
				icon={<ArrowDownTrayIcon className="h-4 w-4 sm:h-6 sm:w-6" />}
				mainValue={aggregates.inputs_completed_count || 0}
				secondaryText={`${(aggregates.inputs_recieved_count || 0).toLocaleString()} recieved`}
				failedCount={aggregates.inputs_failed_count || 0}
			/>

			{/* Outputs Card */}
			<Card
				title="Outputs"
				icon={<ArrowUpTrayIcon className="h-4 w-4 sm:h-6 sm:w-6" />}
				mainValue={aggregates.outputs_completed_count || 0}
				secondaryText={`${(aggregates.outputs_requested_count || 0).toLocaleString()} requested`}
				failedCount={aggregates.outputs_failed_count || 0}
			/>

			{/* Notifications Card */}
			<Card
				title="Notifications"
				icon={<BellIcon className="h-4 w-4 sm:h-6 sm:w-6" />}
				mainValue={aggregates.notifications_sent_count || 0}
				secondaryText={`${(aggregates.notifications_created_count || 0).toLocaleString()} created`}
				failedCount={aggregates.notifications_failed_count || 0}
				to="/notifications"
			/>
		</div>
	);
};

export default StatsCards;
