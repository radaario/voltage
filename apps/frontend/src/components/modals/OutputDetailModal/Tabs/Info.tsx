import { useOutletContext } from "react-router-dom";
import type { JobOutput } from "@/interfaces/job";
import { TableKeyValuePreview } from "@/components";

interface OutletContext {
	output: JobOutput;
}

const Info: React.FC = () => {
	const { output } = useOutletContext<OutletContext>();

	return (
		<TableKeyValuePreview
			data={output}
			excludedKeys={["outcome", "specs", "error"]}
		/>
	);
};

export default Info;
