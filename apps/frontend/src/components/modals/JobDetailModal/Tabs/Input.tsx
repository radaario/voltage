import { useOutletContext } from "react-router-dom";
import type { Job } from "@/interfaces/job";
import { JsonViewer } from "@/components";

interface OutletContext {
	job: Job;
}

const Input: React.FC = () => {
	const { job } = useOutletContext<OutletContext>();

	return (
		<JsonViewer
			data={job?.input}
			emptyMessage="No input data available"
		/>
	);
};

export default Input;
