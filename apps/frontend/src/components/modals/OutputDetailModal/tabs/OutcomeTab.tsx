import { useOutletContext } from "react-router-dom";
import type { JobOutput } from "@/interfaces/job";

interface OutletContext {
	output: JobOutput;
}

const OutcomeTab: React.FC = () => {
	const { output } = useOutletContext<OutletContext>();

	return (
		<div className="space-y-6">
			<div>
				{output.outcome ? (
					<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-4 overflow-auto">
						<pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
							{JSON.stringify(output.outcome, null, 2)}
						</pre>
					</div>
				) : (
					<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-8 text-center">
						<p className="text-gray-500 dark:text-gray-400">No outcome available</p>
					</div>
				)}
				{output.error && (
					<div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
						<p className="text-sm text-red-600 dark:text-red-400 font-mono">{output.error}</p>
					</div>
				)}
			</div>
		</div>
	);
};

export default OutcomeTab;
