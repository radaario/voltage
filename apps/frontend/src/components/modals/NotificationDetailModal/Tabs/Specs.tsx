import { useOutletContext } from "react-router-dom";
import type { Notification } from "@/interfaces/notification";
import { JsonViewer } from "@/components";

interface OutletContext {
	notification: Notification;
}

const Specs: React.FC = () => {
	const { notification } = useOutletContext<OutletContext>();

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
