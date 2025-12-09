import { useOutletContext } from "react-router-dom";
import type { Instance } from "@/interfaces/instance";
import { JsonViewer } from "@/components";

interface OutletContext {
	instance: Instance;
}

const Specs: React.FC = () => {
	const { instance } = useOutletContext<OutletContext>();

	if (!instance) {
		return (
			<div className="flex justify-center items-center py-12">
				<p className="text-sm text-gray-600 dark:text-gray-400">No instance data available.</p>
			</div>
		);
	}

	return (
		<JsonViewer
			data={instance.specs}
			emptyMessage="No specs data available."
		/>
	);
};

export default Specs;
