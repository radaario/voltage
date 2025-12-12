import { useOutletContext } from "react-router-dom";
import { JsonViewer } from "@/components";
import type { InstanceOutletContext } from "@/types/modal";

const Specs: React.FC = () => {
	const { instance } = useOutletContext<InstanceOutletContext>();

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
