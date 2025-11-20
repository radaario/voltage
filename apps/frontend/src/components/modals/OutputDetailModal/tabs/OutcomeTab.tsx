import { useOutletContext } from "react-router-dom";
import type { JobOutput } from "@/interfaces/job";
import { JsonViewer } from "@/components";

interface OutletContext {
	output: JobOutput;
}

const OutcomeTab: React.FC = () => {
	const { output } = useOutletContext<OutletContext>();

	return (
		<div className="space-y-4">
			<JsonViewer
				data={output?.outcome}
				emptyMessage="No outcome available"
			/>
		</div>
	);
};

export default OutcomeTab;
