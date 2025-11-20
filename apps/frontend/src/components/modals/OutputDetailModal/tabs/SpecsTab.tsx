import { useOutletContext } from "react-router-dom";
import type { JobOutput } from "@/interfaces/job";

interface OutletContext {
	output: JobOutput;
}

const SpecsTab: React.FC = () => {
	const { output } = useOutletContext<OutletContext>();

	return (
		<div className="space-y-6">
			<div>
				{output.specs ? (
					<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-4 overflow-auto">
						<pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
							{JSON.stringify(output.specs, null, 2)}
						</pre>
					</div>
				) : (
					<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-8 text-center">
						<p className="text-gray-500 dark:text-gray-400">No specs available</p>
					</div>
				)}
			</div>
		</div>
	);
};

export default SpecsTab;
