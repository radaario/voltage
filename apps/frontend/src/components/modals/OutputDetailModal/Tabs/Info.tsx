import { useOutletContext } from "react-router-dom";
import { TableKeyValuePreview } from "@/components";
import type { OutputOutletContext } from "@/types/modal";

const Info: React.FC = () => {
	const { output } = useOutletContext<OutputOutletContext>();

	return (
		<TableKeyValuePreview
			data={output}
			excludedKeys={["outcome", "specs", "error"]}
		/>
	);
};

export default Info;
