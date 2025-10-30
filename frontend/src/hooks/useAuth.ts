import { useState, useCallback } from "react";
import { AuthState } from "@/interfaces/auth";
import { useNavigate } from "react-router-dom";

export const useAuth = () => {
	const navigate = useNavigate();

	// states
	const [authState, setAuthState] = useState<AuthState>({
		authToken: localStorage.getItem("authToken"),
		isAuthenticated: !!localStorage.getItem("authToken")
	});

	// actions
	const login = useCallback(async (password: string) => {
		try {
			const response = await fetch("http://localhost:8080/dashboard/sign/in", {
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
