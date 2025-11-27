import { useOutletContext } from "react-router-dom";
import type { Notification } from "@/interfaces/notification";
import { JsonViewer } from "@/components";

interface OutletContext {
	notification: Notification;
}

const Outcome: React.FC = () => {
	const { notification } = useOutletContext<OutletContext>();

	if (!notification) {
		return (
			<div className="flex justify-center items-center py-12">
				<p className="text-sm text-gray-600 dark:text-gray-400">No notification data available.</p>
			</div>
		);
	}

	return (
		<JsonViewer
			data={notification.outcome}
			emptyMessage="There is no outcome yet!"
		/>
	);
};

export default Outcome;
