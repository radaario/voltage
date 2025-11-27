import { useOutletContext } from "react-router-dom";
import { Worker } from "@/interfaces/instance";
import { JsonViewer } from "@/components";

const Outcome = () => {
	const { worker } = useOutletContext<{ worker: Worker }>();

	if (!worker) {
		return (
			<div className="text-center py-8">
				<p className="text-gray-500 dark:text-gray-400">Worker data not available</p>
			</div>
		);
	}

	return (
		<JsonViewer
			data={worker.outcome}
			emptyMessage="There is no outcome yet!"
		/>
	);
};

export default Outcome;
