import { useOutletContext } from "react-router-dom";
import { JsonViewer } from "@/components";
import type { JobOutletContext } from "@/types/modal";

const Info: React.FC = () => {
	const { job } = useOutletContext<JobOutletContext>();

	return (
		// Metadata
		<JsonViewer
			data={job.metadata}
			emptyMessage="No metadata available"
		/>
	);
};

export default Info;
