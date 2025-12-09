/**
 * Centralized API client for managing all HTTP requests
 */

// Determine API base URL based on environment
const getApiBaseUrl = (): string => {
	if (import.meta.env.VITE_API_URL) {
		return import.meta.env.VITE_API_URL.replace(":80/", "/");
	}

	// Get current host (protocol + hostname + port if exists)
	const currentHost = `${window.location.protocol}//${window.location.hostname}`;
	return `${currentHost}:${import.meta.env.VITE_API_NODE_PORT || "4000"}`; // ${appBasePath}
};

export interface ApiRequestOptions {
	params?: Record<string, string | number | boolean | undefined | null>;
	headers?: Record<string, string>;
	body?: any;
	formData?: boolean;
	multipart?: boolean;
}

export interface ApiResponse<T = any> {
	metadata?: {
		status: string;
		[key: string]: any;
	};
	data?: T;
	pagination?: {
		total: number;
		page: number;
		limit: number;
		total_pages: number;
		has_more?: boolean;
		next_page?: number | null;
		prev_page?: number | null;
	};
	error?: string;
	message?: string;
}

class ApiClient {
	private baseUrl: string;
	private onUnauthorized?: () => void;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	/**
	 * Set callback for 401 Unauthorized responses
	 */
	setUnauthorizedCallback(callback: () => void): void {
		// Prevent overwriting existing callback
		if (this.onUnauthorized) {
			return;
		}

		this.onUnauthorized = callback;
	}

	/**
	 * Build URL with query parameters
	 */
	private buildUrl(endpoint: string, params?: Record<string, any>): string {
		const url = new URL(`${this.baseUrl}${endpoint}`);

		// Always append client identifier
		url.searchParams.append("client", "FRONTEND");

		// Append additional params
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined && value !== null) {
					url.searchParams.append(key, String(value));
				}
			});
		}

		return url.toString();
	}

	/**
	 * Prepare request headers
	 */
	private prepareHeaders(options?: ApiRequestOptions): HeadersInit {
		const headers: Record<string, string> = {
			...(options?.headers || {})
		};

		// Don't set Content-Type for FormData/multipart - browser will set it automatically with boundary
		if (!options?.multipart && !options?.formData) {
			headers["Content-Type"] = "application/json";
		}

		return headers;
	}

	/**
	 * Prepare request body
	 */
	private prepareBody(body?: any, options?: ApiRequestOptions): BodyInit | undefined {
		if (!body) return undefined;

		if (options?.multipart || options?.formData) {
			const formData = new FormData();
			Object.entries(body).forEach(([key, value]) => {
				if (value !== undefined && value !== null) {
					if (value instanceof File || value instanceof Blob) {
						formData.append(key, value);
					} else {
						formData.append(key, String(value));
					}
				}
			});
			return formData;
		}

		return JSON.stringify(body);
	}

	/**
	 * Generic request method
	 */
	private async request<T = any>(method: string, endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
		try {
			const url = this.buildUrl(endpoint, options?.params);
			const headers = this.prepareHeaders(options);
			const body = this.prepareBody(options?.body, options);

			const response = await fetch(url, {
				method,
				headers,
				body
			});

			if (!response.ok) {
				// Handle 401 Unauthorized
				if (response.status === 401 && this.onUnauthorized) {
					this.onUnauthorized();
				}

				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || errorData.error || `HTTP Error: ${response.status}`);
			}

			const data = await response.json();
			return data;
		} catch (error) {
			console.error(`API ${method} ${endpoint} error:`, error);
			throw error;
		}
	}

	/**
	 * GET request
	 */
	async get<T = any>(
		endpoint: string,
		params?: Record<string, any>,
		options?: Omit<ApiRequestOptions, "params" | "body">
	): Promise<ApiResponse<T>> {
		return this.request<T>("GET", endpoint, { ...options, params });
	}

	/**
	 * POST request
	 */
	async post<T = any>(endpoint: string, body?: any, options?: Omit<ApiRequestOptions, "body">): Promise<ApiResponse<T>> {
		return this.request<T>("POST", endpoint, { ...options, body });
	}

	/**
	 * PUT request
	 */
	async put<T = any>(endpoint: string, body?: any, options?: Omit<ApiRequestOptions, "body">): Promise<ApiResponse<T>> {
		return this.request<T>("PUT", endpoint, { ...options, body });
	}

	/**
	 * PATCH request
	 */
	async patch<T = any>(endpoint: string, body?: any, options?: Omit<ApiRequestOptions, "body">): Promise<ApiResponse<T>> {
		return this.request<T>("PATCH", endpoint, { ...options, body });
	}

	/**
	 * DELETE request
	 */
	async delete<T = any>(
		endpoint: string,
		params?: Record<string, any>,
		options?: Omit<ApiRequestOptions, "params" | "body">
	): Promise<ApiResponse<T>> {
		return this.request<T>("DELETE", endpoint, { ...options, params });
	}

	/**
	 * Get full URL for resources (images, previews, etc.)
	 */
	getResourceUrl(endpoint: string, params?: Record<string, any>): string {
		return this.buildUrl(endpoint, params);
	}
}

// Export singleton instance
export const api = new ApiClient(getApiBaseUrl());

// Export default
export default api;
