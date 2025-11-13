import { useState, useCallback, useEffect } from "react";
import { AuthState } from "@/interfaces/auth";
import { useNavigate } from "react-router-dom";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";

export const useAuth = () => {
	const navigate = useNavigate();
	const { config, configLoading } = useGlobalStateContext();

	// states
	const [authState, setAuthState] = useState<AuthState>({
		authToken: localStorage.getItem("authToken"),
		isAuthenticated: !!localStorage.getItem("authToken")
	});

	// Authentication gerekli değilse otomatik olarak authenticated olarak işaretle
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
			const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password })
			});

			if (!response.ok) {
				throw new Error("Invalid password");
			}

			const responseJson = await response.json();
			const authToken = responseJson.data?.token;

			localStorage.setItem("authToken", authToken);
			setAuthState({ authToken, isAuthenticated: true });
			return true;
		} catch (error) {
			console.error("Login failed:", error);
			return false;
		}
	}, []);

	const logout = useCallback(() => {
		localStorage.removeItem("authToken");
		setAuthState({ authToken: null, isAuthenticated: false });
		navigate("/login");
	}, [navigate]);

	return { ...authState, login, logout };
};
