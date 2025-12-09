import { useOutletContext } from "react-router-dom";
import { Worker } from "@/interfaces/instance";
import { TableKeyValuePreview } from "@/components";

const Info = () => {
	const { worker } = useOutletContext<{ worker: Worker }>();

	return (
		<div className="space-y-6">
			{/* Info Table */}
			<TableKeyValuePreview
				data={worker}
				excludedKeys={["outcome"]}
			/>
		</div>
	);
};

export default Info;
