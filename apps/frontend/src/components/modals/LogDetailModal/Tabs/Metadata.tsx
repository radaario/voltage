import { useOutletContext } from "react-router-dom";
import type { Log } from "@/interfaces/log";
import { JsonViewer } from "@/components";

interface OutletContext {
	log: Log;
}

const Metadata: React.FC = () => {
	const { log } = useOutletContext<OutletContext>();

	return (
		<JsonViewer
			data={log.metadata}
			emptyMessage="No metadata available."
		/>
	);
};

export default Metadata;
