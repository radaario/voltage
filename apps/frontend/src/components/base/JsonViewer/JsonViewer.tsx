import JsonView from "@uiw/react-json-view";
import { darkTheme } from "@uiw/react-json-view/dark";
import { lightTheme } from "@uiw/react-json-view/light";
import { useTheme } from "@/contexts/ThemeContext";

interface JsonViewerProps {
	data: any;
	emptyMessage?: string;
	collapsed?: boolean | number;
}

const JsonViewer = ({ data, emptyMessage = "No data available", collapsed = false }: JsonViewerProps) => {
	const { theme } = useTheme();

	// renders
	if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
		return (
			<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-8 text-center">
				<p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
			</div>
		);
	}

	return (
		<div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-4 overflow-auto">
			<JsonView
				value={data}
				style={{
					...(theme === "dark" ? darkTheme : lightTheme),
					backgroundColor: "transparent",
					fontSize: "0.875rem"
				}}
				collapsed={typeof collapsed === "number" ? collapsed : collapsed ? 1 : false}
				displayDataTypes={false}
				displayObjectSize={true}
				enableClipboard={true}
				shortenTextAfterLength={0} // text ellipsis false
			/>
		</div>
	);
};

export default JsonViewer;
