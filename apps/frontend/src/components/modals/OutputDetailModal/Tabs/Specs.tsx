import { useOutletContext } from "react-router-dom";
import { JsonViewer } from "@/components";
import type { OutputOutletContext } from "@/types/modal";

const Specs: React.FC = () => {
	const { output } = useOutletContext<OutputOutletContext>();

	return (
		<JsonViewer
			data={output?.specs}
			emptyMessage="No specs available"
		/>
	);
};

export default Specs;
