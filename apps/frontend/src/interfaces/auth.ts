export interface AuthState {
	authToken: string | null;
	isAuthenticated: boolean;
}

export interface LoginResponse {
	data: { token: string };
}
