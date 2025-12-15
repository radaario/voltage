import { useOutletContext } from "react-router-dom";
import { JsonViewer } from "@/components";
import type { LogOutletContext } from "@/types/modal";

const Metadata: React.FC = () => {
	const { log } = useOutletContext<LogOutletContext>();

	return (
		<JsonViewer
			data={log.metadata}
			emptyMessage="No metadata available."
		/>
	);
};

export default Metadata;
