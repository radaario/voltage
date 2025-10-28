import DebuggerContainer from "@/containers/Debugger/DebuggerContainer";
import { DebuggerProvider } from "@/containers/Debugger/DebuggerContext";

function Debugger() {
	// const { socket } = useGlobalStateContext();

	// reders
	// if (!socket) {
	// 	return <ScreenLoading />;
	// }

	return (
		<DebuggerProvider>
			<DebuggerContainer />
		</DebuggerProvider>
	);
}

export default Debugger;
