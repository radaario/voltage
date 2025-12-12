import { useOutletContext } from "react-router-dom";
import { TableKeyValuePreview } from "@/components";
import type { NotificationOutletContext } from "@/types/modal";

const Info: React.FC = () => {
	const { notification } = useOutletContext<NotificationOutletContext>();

	return (
		<TableKeyValuePreview
			data={notification}
			excludedKeys={["instance_key", "payload", "outcome", "specs"]}
		/>
	);
};

export default Info;
