import { useOutletContext } from "react-router-dom";
import { JsonViewer } from "@/components";
import type { OutputOutletContext } from "@/types/modal";

const Config: React.FC = () => {
	const { output } = useOutletContext<OutputOutletContext>();

	return (
		<div className="space-y-6">
			{/* Config */}
			<div>
				<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Config</h4>
				<JsonViewer
					data={output.config}
					emptyMessage="No config available"
				/>
			</div>

			{/* Destination */}
			<div>
				<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Destination</h4>
				<JsonViewer
					data={output.destination}
					emptyMessage="No destination available"
				/>
			</div>
		</div>
	);
};

export default Config;
