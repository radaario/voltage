import { useState, useCallback, useEffect } from "react";
import { AuthState } from "@/interfaces/auth";
import { useNavigate } from "react-router-dom";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import { api } from "@/utils";
import { localStorage } from "@/utils";

export const useAuth = () => {
	const navigate = useNavigate() || (() => {});
	const { config, refetchConfig, configLoading } = useGlobalStateContext();

	// states
	const [authState, setAuthState] = useState<AuthState>({
		authToken: (localStorage.get("authToken") as string) || null,
		isAuthenticated: !!localStorage.get("authToken")
	});

	// If authentication is not required, automatically mark as authenticated
	useEffect(() => {
		if (!configLoading && config?.frontend?.is_authentication_required === false) {
			setAuthState({
				authToken: "no-auth-required",
				isAuthenticated: true
			});
		}
	}, [config, configLoading]);

	// actions
	const login = useCallback(async (password: string) => {
		try {
			const response = await api.post("/auth", { password });
			const authToken = (response.data as { token?: string })?.token || null;

			localStorage.set("authToken", authToken);
			setAuthState({ authToken, isAuthenticated: true });
			return true;
		} catch (error) {
			console.error("Login failed:", error);
			throw error;
		}
	}, []);

	const logout = useCallback(() => {
		localStorage.remove("authToken");
		setAuthState({ authToken: null, isAuthenticated: false });
		refetchConfig();
		navigate("/login");
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Automatically logout on 401 error
	useEffect(() => {
		api.setUnauthorizedCallback(() => {
			logout();
		});
	}, [logout]);

	return { ...authState, login, logout };
};
