import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import ScreenLoading from "@/components/ScreenLoading/ScreenLoading";
import EventList from "@/containers/Debugger/EventList/EventList";
import EventDetail from "@/containers/Debugger/EventDetail/EventDetail";

function DebuggerContainer() {
	const { isLoading } = useGlobalStateContext();

	// renders
	if (isLoading) {
		return <ScreenLoading />;
	}

	return (
		<div className="h-full flex gap-8">
			<EventList />
			<EventDetail />
		</div>
	);
}

export default DebuggerContainer;
