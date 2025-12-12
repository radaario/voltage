import { useOutletContext } from "react-router-dom";
import { JsonViewer } from "@/components";
import type { NotificationOutletContext } from "@/types/modal";

const Payload: React.FC = () => {
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
			data={notification.payload}
			emptyMessage="No payload available"
		/>
	);
};

export default Payload;
