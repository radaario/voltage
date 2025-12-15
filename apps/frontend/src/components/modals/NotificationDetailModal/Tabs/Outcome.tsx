import { useOutletContext } from "react-router-dom";
import { JsonViewer } from "@/components";
import type { NotificationOutletContext } from "@/types/modal";

const Outcome: React.FC = () => {
	const { notification } = useOutletContext<NotificationOutletContext>();

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
