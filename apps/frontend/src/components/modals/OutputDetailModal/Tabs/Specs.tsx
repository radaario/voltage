import { useOutletContext } from "react-router-dom";
import type { JobOutput } from "@/interfaces/job";
import { JsonViewer } from "@/components";

interface OutletContext {
	output: JobOutput;
}

const Specs: React.FC = () => {
	const { output } = useOutletContext<OutletContext>();

	return (
		<JsonViewer
			data={output?.specs}
			emptyMessage="No specs available"
		/>
	);
};

export default Specs;
