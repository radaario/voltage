import { useOutletContext } from "react-router-dom";
import { TableKeyValuePreview } from "@/components";
import type { LogOutletContext } from "@/types/modal";

const Info: React.FC = () => {
	const { log } = useOutletContext<LogOutletContext>();

	return (
		<div className="space-y-6">
			<TableKeyValuePreview
				data={log}
				excludedKeys={["metadata", "instance_key"]}
			/>
		</div>
	);
};

export default Info;
