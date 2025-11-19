import { useOutletContext } from "react-router-dom";
import type { Notification } from "@/interfaces/notification";

interface OutletContext {
	notification: Notification;
}

const NotificationOutcomeTab: React.FC = () => {
	const { notification } = useOutletContext<OutletContext>();

	if (!notification) {
		return (
			<div className="flex justify-center items-center py-12">
				<p className="text-sm text-gray-600 dark:text-gray-400">No notification data available.</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				{/* <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Outcome</h4> */}

				{notification.outcome ? (
					<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-4 overflow-auto">
						<pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
							{JSON.stringify(notification.outcome, null, 2)}
						</pre>
					</div>
				) : (
					<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-8 text-center">
						<p className="text-gray-500 dark:text-gray-400">No outcome available</p>
					</div>
				)}
			</div>
		</div>
	);
};

export default NotificationOutcomeTab;
