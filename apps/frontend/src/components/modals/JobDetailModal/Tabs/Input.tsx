import { useOutletContext } from "react-router-dom";
import { JsonViewer } from "@/components";
import type { JobOutletContext } from "@/types/modal";

const Input: React.FC = () => {
	const { job } = useOutletContext<JobOutletContext>();

	return (
		<JsonViewer
			data={job?.input}
			emptyMessage="No input data available"
		/>
	);
};

export default Input;
