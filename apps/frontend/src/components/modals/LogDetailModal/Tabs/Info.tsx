import { useOutletContext } from "react-router-dom";
import type { Log } from "@/interfaces/log";
import { TableKeyValuePreview } from "@/components";

interface OutletContext {
	log: Log;
}

const Info: React.FC = () => {
	const { log } = useOutletContext<OutletContext>();

	return (
		<div className="space-y-6">
			<TableKeyValuePreview
				data={log}
				excludedKeys={["metadata", "instance_key"]}
			/>
		</div>
	);
};

export default Info;
