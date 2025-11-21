import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { router } from "@/routes";
import { GlobalStateProvider } from "@/contexts/GlobalStateContext";
import { ModalProvider } from "@/contexts/ModalContext";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: true,
			refetchInterval: 5000,
			staleTime: 4000
		}
	}
});

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<GlobalStateProvider>
				<ThemeProvider>
					<ModalProvider>
						<RouterProvider
							router={router}
							future={{ v7_startTransition: true }}
						/>
					</ModalProvider>
				</ThemeProvider>
			</GlobalStateProvider>
		</QueryClientProvider>
	);
}

export default App;
