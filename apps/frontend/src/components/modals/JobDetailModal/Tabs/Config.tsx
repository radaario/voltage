import { useOutletContext } from "react-router-dom";
import { JsonViewer } from "@/components";
import type { JobOutletContext } from "@/types/modal";

const Config: React.FC = () => {
	const { job } = useOutletContext<JobOutletContext>();

	return (
		<div className="space-y-6">
			{/* Config */}
			<div>
				<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Config</h4>
				<JsonViewer
					data={job.config}
					emptyMessage="No config available"
				/>
			</div>

			{/* Destination */}
			<div>
				<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Destination</h4>
				<JsonViewer
					data={job.destination}
					emptyMessage="No destination available"
				/>
			</div>

			{/* Notification */}
			<div>
				<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notification</h4>
				<JsonViewer
					data={job.notification}
					emptyMessage="No notification available"
				/>
			</div>
		</div>
	);
};

export default Config;
