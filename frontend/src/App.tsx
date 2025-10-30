import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { router } from "@/routes";
import { GlobalStateProvider } from "@/contexts/GlobalStateContext";

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
					<RouterProvider
						router={router}
						future={{ v7_startTransition: true }}
					/>
				</ThemeProvider>
			</GlobalStateProvider>
		</QueryClientProvider>
	);
}

export default App;
