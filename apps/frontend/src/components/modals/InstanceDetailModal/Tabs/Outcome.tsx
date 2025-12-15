import { useOutletContext } from "react-router-dom";
import { JsonViewer } from "@/components";
import type { InstanceOutletContext } from "@/types/modal";

const Outcome: React.FC = () => {
	const { instance } = useOutletContext<InstanceOutletContext>();

	return (
		<JsonViewer
			data={instance.outcome}
			emptyMessage="There is no outcome yet!"
		/>
	);
};

export default Outcome;
