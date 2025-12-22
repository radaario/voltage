import { useOutletContext } from "react-router-dom";
import { JsonViewer } from "@/components";
import type { JobOutletContext } from "@/types/modal";

const Info: React.FC = () => {
	const { job } = useOutletContext<JobOutletContext>();

	return (
		<div className="space-y-6">
			{/* Metadata */}
			<JsonViewer
				data={job.metadata}
				emptyMessage="No metadata available"
			/>
		</div>
	);
};

export default Info;
