import { useOutletContext } from "react-router-dom";
import type { Instance } from "@/interfaces/instance";
import { JsonViewer } from "@/components";

interface OutletContext {
	instance: Instance;
}

const Outcome: React.FC = () => {
	const { instance } = useOutletContext<OutletContext>();

	return (
		<JsonViewer
			data={instance.outcome}
			emptyMessage="There is no outcome yet!"
		/>
	);
};

export default Outcome;
