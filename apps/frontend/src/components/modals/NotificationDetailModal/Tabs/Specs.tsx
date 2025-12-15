import { useOutletContext } from "react-router-dom";
import { JsonViewer } from "@/components";
import type { NotificationOutletContext } from "@/types/modal";

const Specs: React.FC = () => {
	const { notification } = useOutletContext<NotificationOutletContext>();

	return (
		<div className="space-y-4">
			<JsonViewer
				data={notification.specs}
				emptyMessage="No notification data available"
			/>
		</div>
	);
};

export default Specs;
