import ReactJson from "react-json-view";
import { useTheme } from "@/contexts/ThemeContext";

interface JsonViewerProps {
	data: any;
	emptyMessage?: string;
	collapsed?: boolean | number;
}

const JsonViewer: React.FC<JsonViewerProps> = ({ data, emptyMessage = "No data available", collapsed = false }) => {
	const { theme } = useTheme();

	if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
		return (
			<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-8 text-center">
				<p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
			</div>
		);
	}

	return (
		<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-4 overflow-auto">
			<ReactJson
				src={data}
				theme={theme === "dark" ? "monokai" : "rjv-default"}
				collapsed={collapsed}
				displayDataTypes={false}
				displayObjectSize={true}
				enableClipboard={(copy) => {
					const value = copy.src;
					navigator.clipboard.writeText(typeof value === "string" ? value : JSON.stringify(value, null, 2));
				}}
				name={false}
				iconStyle="triangle"
				style={{
					backgroundColor: "transparent",
					fontSize: "0.875rem"
				}}
			/>
		</div>
	);
};

export default JsonViewer;
