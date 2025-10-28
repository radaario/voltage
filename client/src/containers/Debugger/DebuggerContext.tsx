import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import { filter, isEmpty, isNil, reverse, sortBy } from "lodash";
import { IEvent } from "@/interfaces";

export const DebuggerContext = createContext<any>({});

export const useDebuggerContext = () => useContext(DebuggerContext);

export const DebuggerContextConsumer = DebuggerContext.Consumer;

export function DebuggerProvider({ children }: { children: React.ReactNode }) {
	const { setLoading } = useGlobalStateContext();

	// states
	const [events, setEvents] = useState<IEvent[]>([]);
	const [filters, setFilters] = useState<any>({});
	const [selectedEvent, setSelectedEvent] = useState<IEvent | null>(null);
	const [isSelectedAnEvent, setSelectedAnEvent] = useState<boolean>(false);

	// data
	const filteredEvents = useMemo(
		() =>
			filter(events, (event: any) => {
				// validation: source
				if (!isEmpty(filters.source) && filters.source !== event.source) {
					return false;
				}

				// validation: source
				if (!isEmpty(filters.type) && filters.type !== event.type) {
					return false;
				}

				return true;
			}),
		[events, filters]
	);
	const sortedEvents = useMemo(() => reverse(sortBy(filteredEvents, ["createdAt"])), [filteredEvents]);

	// actions

	// effects
	useLayoutEffect(() => {
		const onGetEvents = (events: IEvent[]) => {
			if (!isNil(events)) {
				setEvents(events);
			}

			setLoading(false);
		};

		// get workers
		// socket.on(SOCKET_EVENTS.CLIENT.GET_EVENTS, onGetEvents);
		// return () => socket.off(SOCKET_EVENTS.CLIENT.GET_EVENTS, onGetEvents);
	}, []);

	useEffect(() => {
		if (isEmpty(sortedEvents)) {
			if (selectedEvent) {
				setSelectedEvent(null);
			}

			setSelectedAnEvent(false);
			return;
		}

		if (isSelectedAnEvent) {
			return;
		}

		setSelectedAnEvent(true);
		setSelectedEvent(sortedEvents[0]);
	}, [sortedEvents]);

	// context
	const context = {
		// states
		// socket,
		events,
		setEvents,
		selectedEvent,
		setSelectedEvent,
		filters,
		setFilters,
		isSelectedAnEvent,
		setSelectedAnEvent,

		// data
		sortedEvents

		// actions
	};

	return <DebuggerContext.Provider value={context}>{children}</DebuggerContext.Provider>;
}
