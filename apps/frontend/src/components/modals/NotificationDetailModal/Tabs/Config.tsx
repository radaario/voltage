import { useOutletContext } from "react-router-dom";
import { JsonViewer } from "@/components";
import type { NotificationOutletContext } from "@/types/modal";

const Config: React.FC = () => {
	const { notification } = useOutletContext<NotificationOutletContext>();

	return (
		<div className="space-y-4">
			<JsonViewer
				data={notification.config}
				emptyMessage="No notification data available"
			/>
		</div>
	);
};

export default Config;
