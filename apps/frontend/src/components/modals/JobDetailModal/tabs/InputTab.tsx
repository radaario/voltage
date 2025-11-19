import { useOutletContext } from "react-router-dom";
import type { Job } from "@/interfaces/job";

interface OutletContext {
	job: Job;
}

const InputTab: React.FC = () => {
	const { job } = useOutletContext<OutletContext>();

	// Convert input object to key-value pairs
	const inputEntries = job?.input ? Object.entries(job.input).filter(([_, value]) => value !== undefined && value !== null) : [];

	if (!job?.input || inputEntries.length === 0) {
		return (
			<div className="text-center py-12">
				<p className="text-gray-500 dark:text-gray-400">No input data available</p>
			</div>
		);
	}

	return (
		<div>
			{/* Input Json */}
			<div>
				{job?.input ? (
					<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-4 overflow-auto">
						<pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
							{JSON.stringify(job?.input, null, 2)}
						</pre>
					</div>
				) : (
					<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-8 text-center">
						<p className="text-gray-500 dark:text-gray-400">No inputs available</p>
					</div>
				)}
			</div>
		</div>
	);
};

export default InputTab;
