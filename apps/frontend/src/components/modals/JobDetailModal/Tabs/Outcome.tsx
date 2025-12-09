import { useOutletContext } from "react-router-dom";
import type { Job } from "@/interfaces/job";
import { JsonViewer } from "@/components";

interface OutletContext {
	job: Job;
}

const Outcome: React.FC = () => {
	const { job } = useOutletContext<OutletContext>();

	return (
		<JsonViewer
			data={job?.outcome}
			emptyMessage="There is no outcome yet!"
		/>
	);
};

export default Outcome;
