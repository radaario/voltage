import { useOutletContext } from "react-router-dom";
import type { Job } from "@/interfaces/job";
import { TableKeyValuePreview, JsonViewer } from "@/components";

interface OutletContext {
	job: Job;
}

const Info: React.FC = () => {
	const { job } = useOutletContext<OutletContext>();

	return (
		<div className="space-y-6">
			{/* Info Table */}
			<TableKeyValuePreview
				data={job}
				excludedKeys={["input", "instance_key", "outputs", "outcome", "config", "destination", "notification", "metadata"]}
			/>

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

			{/* Config */}
			<div>
				<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Config</h4>
				<JsonViewer
					data={job.config}
					emptyMessage="No config available"
				/>
			</div>

			{/* Metadata */}
			<div>
				<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Metadata</h4>
				<JsonViewer
					data={job.metadata}
					emptyMessage="No metadata available"
				/>
			</div>
		</div>
	);
};

export default Info;
