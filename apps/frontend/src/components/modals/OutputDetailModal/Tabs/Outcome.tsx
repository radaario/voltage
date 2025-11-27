import { useOutletContext } from "react-router-dom";
import type { JobOutput } from "@/interfaces/job";
import { JsonViewer } from "@/components";

interface OutletContext {
	output: JobOutput;
}

const Outcome: React.FC = () => {
	const { output } = useOutletContext<OutletContext>();

	return (
		<div className="space-y-4">
			<JsonViewer
				data={output?.outcome}
				emptyMessage="There is no outcome yet!"
			/>
		</div>
	);
};

export default Outcome;
