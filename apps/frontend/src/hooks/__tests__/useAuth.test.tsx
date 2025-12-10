import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "../useAuth";
import { GlobalStateProvider } from "../../contexts/GlobalStateContext";

// Mock api and localStorage
vi.mock("@/utils", () => ({
	api: {
		post: vi.fn(),
		get: vi.fn().mockResolvedValue({ name: "Test App" }),
		setUnauthorizedCallback: vi.fn()
	},
	localStorage: {
		get: vi.fn().mockReturnValue(null),
		set: vi.fn(),
		remove: vi.fn()
	}
}));

// Create a test query client
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: false
		}
	}
});

// Wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
	return (
		<QueryClientProvider client={queryClient}>
			<MemoryRouter>
				<GlobalStateProvider>{children}</GlobalStateProvider>
			</MemoryRouter>
		</QueryClientProvider>
	);
}
describe("useAuth hook", () => {
	it("should initialize with hook defined", () => {
		const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });
		expect(result.current).toBeDefined();
	});

	it("should have login function", () => {
		const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });
		expect(typeof result.current.login).toBe("function");
	});

	it("should have logout function", () => {
		const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });
		expect(typeof result.current.logout).toBe("function");
	});
});
