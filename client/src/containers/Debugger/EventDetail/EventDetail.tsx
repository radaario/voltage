import ReactJson from "react-json-view";
import { useDebuggerContext } from "@/containers/Debugger/DebuggerContext";
import { useMemo } from "react";
import { isObject } from "lodash";

function EventDetail() {
	const { selectedEvent } = useDebuggerContext();

	console.log("selectedEvent:", selectedEvent);

	// data
	const jsonEventMessage = useMemo(() => {
		if (!selectedEvent) {
			return null;
		}

		try {
			const parsedEventMessage = isObject(selectedEvent.message) ? selectedEvent.message : JSON.parse(selectedEvent.message);

			return {
				...parsedEventMessage,
				source: undefined,
				type: undefined,
				description: undefined,
				environment: undefined
			};
		} catch (err) {
			console.log("json event message parse error:", err);
			return null;
		}
	}, [selectedEvent]);

	// actions
	const handleCopy = () => {
		const text = jsonEventMessage ? JSON.stringify(jsonEventMessage, null, 2) : selectedEvent.message;
		navigator.clipboard.writeText(text || "");
	};

	return (
		<div className="flex-1 max-w-[calc(50%-15px)] h-full p-8 rounded bg-neutral-900">
			<div className="flex flex-wrap pb-5">
				<div className="flex-1 text-gray-300 text-lg">Message</div>
				<div className="ml-auto pl-4 flex items-center justify-center gap-2.5">
					<button
						className="flex items-center justify-center text-center w-8 cursor-pointer h-8 rounded-full bg-neutral-800 border-none transition-all duration-200 hover:bg-neutral-600 disabled:opacity-70 disabled:cursor-not-allowed"
						title="Copy"
						disabled={!selectedEvent}
						onClick={handleCopy}>
						<i className="icon-docs text-sm text-gray-200" />
					</button>
				</div>
			</div>
			<div className="h-[calc(100%-30px)] bg-neutral-700 rounded overflow-auto pr-1 scroll-smooth">
				{jsonEventMessage ? (
					<div className="rounded p-2.5 bg-neutral-700">
						<ReactJson
							// Demo Page:
							// https://mac-s-g.github.io/react-json-view/demo/dist/
							src={jsonEventMessage}
							name={null} // null | "root"
							displayDataTypes={false}
							// displayObjectSize={false}
							theme="ocean"
							// onEdit={true}
						/>
					</div>
				) : (
					<>
						{selectedEvent && selectedEvent.message ? (
							<div className="p-2.5">{selectedEvent.message}</div>
						) : (
							<div className="w-full h-full flex flex-col justify-center items-center text-center text-gray-300 gap-1.5 text-lg">
								<i className="icon-left text-4xl" />
								Select An Event
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}

export default EventDetail;
