import { useOutletContext } from "react-router-dom";
import type { Instance } from "@/interfaces/instance";

interface OutletContext {
	instance: Instance;
}

const InstanceOutcomeTab: React.FC = () => {
	const { instance } = useOutletContext<OutletContext>();

	if (!instance) {
		return (
			<div className="flex justify-center items-center py-12">
				<p className="text-sm text-gray-600 dark:text-gray-400">No instance data available.</p>
			</div>
		);
	}

	if (!instance.specs) {
		return (
			<div className="flex justify-center items-center py-12">
				<p className="text-sm text-gray-600 dark:text-gray-400">No specs data available.</p>
			</div>
		);
	}

	return (
		<div className="overflow-hidden border border-gray-200 dark:border-neutral-700 rounded-lg">
			<div className="bg-white dark:bg-neutral-800 p-6">
				<pre className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap font-mono overflow-auto max-h-[500px]">
					{JSON.stringify(instance.specs, null, 2)}
				</pre>
			</div>
		</div>
	);
};

export default InstanceOutcomeTab;
