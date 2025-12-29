import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "../useAuth";
import { BrowserRouter } from "react-router-dom";
import { createElement } from "react";
import * as GlobalStateContext from "@/contexts/GlobalStateContext";
import * as utils from "@/utils";
import * as ReactRouter from "react-router-dom";

// Mock dependencies
vi.mock("@/contexts/GlobalStateContext", () => ({
	useGlobalStateContext: vi.fn()
}));
vi.mock("@/utils");
vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual<typeof ReactRouter>("react-router-dom");
	return {
		...actual,
		useNavigate: vi.fn(() => vi.fn())
	};
});

const wrapper = ({ children }: { children: React.ReactNode }) => createElement(BrowserRouter, null, children);

describe("useAuth hook", () => {
	const mockLocalStorage = {
		get: vi.fn(),
		set: vi.fn(),
		remove: vi.fn()
	};

	const mockApi = {
		post: vi.fn(),
		setUnauthorizedCallback: vi.fn()
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup default mocks
		vi.mocked(utils).localStorage = mockLocalStorage as any;
		vi.mocked(utils).api = mockApi as any;

		vi.mocked(GlobalStateContext.useGlobalStateContext).mockReturnValue({
			config: {
				frontend: {
					is_authentication_required: true
				}
			},
			refetchConfig: vi.fn(),
			configLoading: false,
			currentScreenDimension: "desktop",
			setCurrentScreenDimension: vi.fn(),
			isLoading: false,
			setLoading: vi.fn(),
			isSidebarCollapsed: false,
			setIsSidebarCollapsed: vi.fn(),
			activeWorkspaceId: null
		} as any);
	});

	it("should initialize with token from localStorage", () => {
		mockLocalStorage.get.mockReturnValue("stored-token");

		const { result } = renderHook(() => useAuth(), { wrapper });

		expect(result.current.authToken).toBe("stored-token");
		expect(result.current.isAuthenticated).toBe(true);
	});

	it("should initialize as unauthenticated without token", () => {
		mockLocalStorage.get.mockReturnValue(null);

		const { result } = renderHook(() => useAuth(), { wrapper });

		expect(result.current.authToken).toBe(null);
		expect(result.current.isAuthenticated).toBe(false);
	});

	it("should login successfully", async () => {
		mockLocalStorage.get.mockReturnValue(null);
		mockApi.post.mockResolvedValue({ data: { token: "test-token" } });

		const { result } = renderHook(() => useAuth(), { wrapper });

		await act(async () => {
			await result.current.login("test-password");
		});

		expect(mockApi.post).toHaveBeenCalledWith("/auth", { password: "test-password" });
		expect(mockLocalStorage.set).toHaveBeenCalledWith("authToken", "test-token");
		expect(result.current.isAuthenticated).toBe(true);
	});

	it("should handle login failure", async () => {
		mockLocalStorage.get.mockReturnValue(null);
		mockApi.post.mockRejectedValueOnce(new Error("Login failed"));

		const { result } = renderHook(() => useAuth(), { wrapper });

		await expect(async () => {
			await act(async () => {
				await result.current.login("wrong-password");
			});
		}).rejects.toThrow("Login failed");
	});

	it("should logout successfully", async () => {
		mockLocalStorage.get.mockReturnValue("test-token");
		const mockRefetchConfig = vi.fn();
		vi.mocked(GlobalStateContext.useGlobalStateContext).mockReturnValue({
			config: { frontend: { is_authentication_required: true } },
			refetchConfig: mockRefetchConfig,
			configLoading: false,
			currentScreenDimension: "desktop",
			setCurrentScreenDimension: vi.fn(),
			isLoading: false,
			setLoading: vi.fn(),
			isSidebarCollapsed: false,
			setIsSidebarCollapsed: vi.fn(),
			activeWorkspaceId: null
		} as any);

		const { result } = renderHook(() => useAuth(), { wrapper });

		await act(async () => {
			result.current.logout();
		});

		expect(mockLocalStorage.remove).toHaveBeenCalledWith("authToken");
		expect(result.current.authToken).toBe(null);
		expect(result.current.isAuthenticated).toBe(false);
	});

	it("should auto-authenticate when auth not required", async () => {
		mockLocalStorage.get.mockReturnValue(null);
		vi.mocked(GlobalStateContext.useGlobalStateContext).mockReturnValue({
			config: { frontend: { is_authentication_required: false } },
			refetchConfig: vi.fn(),
			configLoading: false,
			currentScreenDimension: "desktop",
			setCurrentScreenDimension: vi.fn(),
			isLoading: false,
			setLoading: vi.fn(),
			isSidebarCollapsed: false,
			setIsSidebarCollapsed: vi.fn(),
			activeWorkspaceId: null
		} as any);

		const { result } = renderHook(() => useAuth(), { wrapper });

		// Wait for useEffect to run
		await waitFor(() => {
			expect(result.current.isAuthenticated).toBe(true);
		});

		expect(result.current.authToken).toBe("no-auth-required");
	});
});
