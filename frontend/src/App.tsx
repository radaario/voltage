import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { router } from "@/routes";
import { GlobalStateProvider } from "@/contexts/GlobalStateContext";

function App() {
	return (
		<GlobalStateProvider>
			<ThemeProvider>
				<RouterProvider
					router={router}
					future={{ v7_startTransition: true }}
				/>
			</ThemeProvider>
		</GlobalStateProvider>
	);
}

export default App;
