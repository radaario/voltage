import { useOutletContext } from "react-router-dom";
import { TableKeyValuePreview } from "@/components";
import type { JobOutletContext } from "@/types/modal";

const Info: React.FC = () => {
	const { job } = useOutletContext<JobOutletContext>();

	return (
		// Info Table
		<TableKeyValuePreview
			data={job}
			excludedKeys={["input", "instance_key", "outputs", "outcome", "config", "destination", "notification", "metadata"]}
		/>
	);
};

export default Info;
