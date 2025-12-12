import { useOutletContext } from "react-router-dom";
import { JsonViewer } from "@/components";
import type { OutputOutletContext } from "@/types/modal";

const Outcome: React.FC = () => {
	const { output } = useOutletContext<OutputOutletContext>();

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
