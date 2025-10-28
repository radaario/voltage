import DebuggerEvent from "@/containers/Debugger/Event/Event";
import { IEvent } from "@/interfaces";
import { isEmpty, map, uniq } from "lodash";
import { EVENT_TYPES } from "@/constants";
import { useDebuggerContext } from "@/containers/Debugger/DebuggerContext";
import { useMemo } from "react";

function EventList() {
	const { events, sortedEvents, filters, setFilters } = useDebuggerContext();

	// data
	const customSources = useMemo(() => {
		return uniq(["unknown", ...map(events, "source")]);
	}, [events]);

	// actions
	const handleChangeByKey = (key: string) => (e: any) => {
		setFilters((filters: any) => ({ ...filters, [key]: e.target.value }));
	};

	const handleClearFilters = () => {
		setFilters({});
	};

	return (
		<div className="flex-1 max-w-[calc(50%-15px)] h-full p-8 rounded flex flex-col bg-neutral-900">
			<div className="flex flex-wrap -mt-4 mb-4">
				<div className="flex-1 text-gray-300 text-lg">
					Events (<b>{events.length}</b>)
				</div>
				<div className="flex flex-wrap ml-auto gap-2.5 justify-end">
					<select
						className="border-0 py-1.5 px-2 bg-neutral-700 text-white rounded"
						onChange={handleChangeByKey("source")}
						value={filters.source || ""}>
						<option value="">All Sources</option>
						{map(customSources, (source: any, index: number) => (
							<option
								key={index}
								value={source}>
								{source}
							</option>
						))}
					</select>
					<select
						className="border-0 py-1.5 px-2 bg-neutral-700 text-white rounded"
						onChange={handleChangeByKey("type")}
						value={filters.type || ""}>
						<option value="">All Types</option>
						{map(EVENT_TYPES, (type: any, key: string) => (
							<option
								key={key}
								value={key}>
								{type.label}
							</option>
						))}
					</select>
				</div>
			</div>
			<div className="h-[calc(100%-20px)] bg-neutral-800 p-2.5 rounded-xl">
				<div className="h-full rounded overflow-auto pr-1 scroll-smooth">
					<div className="h-full flex flex-col gap-2.5 rounded">
						{sortedEvents.map((event: IEvent) => (
							<DebuggerEvent
								key={event.key}
								event={event}
							/>
						))}
						{isEmpty(sortedEvents) && (
							<>
								<div className="w-full h-full flex flex-col justify-center items-center text-center text-gray-300 gap-1.5 text-lg">
									<i className="icon-attention-circled text-4xl" />
									No events found
									{!isEmpty(filters) && (
										<button
											className="bg-neutral-700 border-0 py-2 px-3 text-sm mt-2.5 text-gray-200 rounded cursor-pointer"
											onClick={handleClearFilters}>
											Clear Filters
										</button>
									)}
								</div>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

export default EventList;
