import { useOutletContext } from "react-router-dom";
import { JsonViewer } from "@/components";
import type { OutputOutletContext } from "@/types/modal";

const Metadata: React.FC = () => {
	const { output } = useOutletContext<OutputOutletContext>();

	return (
		<div className="space-y-6">
			{/* Metadata */}
			<JsonViewer
				data={output.metadata}
				emptyMessage="No metadata available"
			/>
		</div>
	);
};

export default Metadata;
