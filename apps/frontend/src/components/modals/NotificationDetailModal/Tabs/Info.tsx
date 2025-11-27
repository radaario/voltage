import { useOutletContext } from "react-router-dom";
import type { Notification } from "@/interfaces/notification";
import { TableKeyValuePreview } from "@/components";

interface OutletContext {
	notification: Notification;
}

const Info: React.FC = () => {
	const { notification } = useOutletContext<OutletContext>();

	return (
		<TableKeyValuePreview
			data={notification}
			excludedKeys={["instance_key", "payload", "outcome", "specs"]}
		/>
	);
};

export default Info;
