import { useOutletContext } from "react-router-dom";
import { JsonViewer } from "@/components";
import type { JobOutletContext } from "@/types/modal";

const Outcome: React.FC = () => {
	const { job } = useOutletContext<JobOutletContext>();

	return (
		<JsonViewer
			data={job?.outcome}
			emptyMessage="There is no outcome yet!"
		/>
	);
};

export default Outcome;
