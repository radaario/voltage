import { useOutletContext } from "react-router-dom";
import type { Log } from "@/interfaces/log";

interface OutletContext {
	log: Log;
}

const InfoTab: React.FC = () => {
	const { log } = useOutletContext<OutletContext>();

	if (!log) {
		return (
			<div className="flex justify-center items-center py-12">
				<p className="text-sm text-gray-600 dark:text-gray-400">No log data available.</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Message</h4>
				<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-4 overflow-auto">
					<pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">{log.message || "-"}</pre>
				</div>
			</div>
		</div>
	);
};

export default InfoTab;
