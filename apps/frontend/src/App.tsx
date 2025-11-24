import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { router } from "@/routes";
import { GlobalStateProvider } from "@/contexts/GlobalStateContext";
import { ModalProvider } from "@/contexts/ModalContext";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: (failureCount, error) => {
				// Don't retry on 404 errors, retry max 3 times for server errors (500, etc.)
				const is404 = error?.message?.includes("404") || error?.message?.toLowerCase().includes("not found");
				return !is404 && failureCount < 3;
			},
			refetchInterval: (query) => {
				// Only refetch every 15 seconds if we have successful data
				return query.state.data ? 15000 : false;
			},
			staleTime: 15_000 // Consider data fresh for 15 seconds
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
