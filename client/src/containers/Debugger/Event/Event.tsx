import { IEvent } from "@/interfaces";
import Moment from "react-moment";
import { useDebuggerContext } from "@/containers/Debugger/DebuggerContext";
import { useMemo } from "react";
import { clsx } from "@/utils";
import { EVENT_TYPES } from "@/constants";
import { first, get, isEmpty } from "lodash";

function DebuggerEvent({ event }: { event: IEvent }) {
	const { setSelectedEvent, selectedEvent, setSelectedAnEvent } = useDebuggerContext();

	// data
	const isActive = useMemo(() => selectedEvent && event.key === selectedEvent.key, [selectedEvent]);
	const alert = useMemo(() => {
		const type = get(EVENT_TYPES, event.type);

		if (!type) {
			return first(EVENT_TYPES);
		}

		return type;
	}, [event.type]);
	const displayMessage = useMemo(() => {
		if (!event.message) {
			return null;
		}

		return {
			...(event.message as any),
			source: undefined,
			type: undefined,
			description: undefined,
			environment: undefined
		};
	}, [event.message]);

	const message = useMemo(() => {
		if (!isEmpty(event.description)) {
			return event.description;
		}

		const displayMessageStringify = `${JSON.stringify(displayMessage, null, 2)}`;

		return displayMessageStringify.slice(0, 500);
	}, []);

	// actions
	const handleSelect = (e: any) => {
		e.preventDefault();
		if (selectedEvent && selectedEvent.key === event.key) {
			setSelectedEvent(null);
			return;
		}

		setSelectedEvent(event);
	};

	const handleDelete = (e: any) => {
		e.preventDefault();
		setSelectedEvent(null);
		setSelectedAnEvent(false);
		// socket.emit(SOCKET_EVENTS.CLIENT.SEND_EVENT_DELETE, event.key);
	};

	return (
		<div
			className={clsx("relative flex py-4 px-5 pl-8 bg-neutral-900 rounded transition-colors duration-200 hover:cursor-pointer hover:bg-neutral-700", {
				"bg-neutral-600": isActive
			})}
			onClick={handleSelect}>
			<div
				className="absolute left-0 top-0 bottom-0 w-4.5 rounded-l"
				style={{ backgroundColor: alert.hex }}>
				<span className="h-full pt-2.5 pl-0.5 text-center text-xs text-white font-bold whitespace-nowrap"
					style={{
						writingMode: 'vertical-lr',
						textOrientation: 'sideways-right'
					}}>
					{alert.label}
				</span>
			</div>
			<div className="absolute left-0 top-0 py-1.5 px-0 text-sm font-bold rounded-br">
				<i className={alert.iconClasses} />
			</div>
			<div className="flex flex-col">
				<div className="font-bold text-sm">
					{event.source || "unknown"}
					{!isEmpty(event.environment) ? `:${event.environment}` : null}
				</div>
				<div className="text-ellipsis-custom text-base">{message}</div>
				<div className="text-xs text-gray-400">
					<Moment fromNow>{event.createdAt}</Moment>
				</div>
			</div>
			<div className="ml-auto pl-4 flex items-center justify-center gap-2.5">
				<button
					className="flex items-center justify-center text-center w-8 cursor-pointer h-8 rounded-full bg-neutral-800 border-none text-gray-200 transition-all duration-200 hover:bg-red-600"
					title="Delete"
					onClick={handleDelete}>
					<i className="icon-trash text-sm" />
				</button>
			</div>
		</div>
	);
}

export default DebuggerEvent;
