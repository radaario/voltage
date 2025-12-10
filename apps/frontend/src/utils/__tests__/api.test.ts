import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "../api";

// Mock window.location
const mockLocation = {
	protocol: "http:",
	hostname: "localhost"
};

Object.defineProperty(window, "location", {
	value: mockLocation,
	writable: true
});

// Mock fetch
global.fetch = vi.fn();

describe("API Client", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("singleton instance", () => {
		it("should export API client instance", () => {
			expect(api).toBeDefined();
		});

		it("should have HTTP methods", () => {
			expect(typeof api.get).toBe("function");
			expect(typeof api.post).toBe("function");
			expect(typeof api.put).toBe("function");
			expect(typeof api.delete).toBe("function");
		});

		it("should have setUnauthorizedCallback method", () => {
			expect(typeof api.setUnauthorizedCallback).toBe("function");
		});

		it("should have getResourceUrl method", () => {
			expect(typeof api.getResourceUrl).toBe("function");
		});
	});

	describe("HTTP methods", () => {
		it("should make GET request", async () => {
			const mockResponse = { data: "test" };
			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse
			});

			const result = await api.get("/test");
			expect(result).toEqual(mockResponse);
			expect(global.fetch).toHaveBeenCalled();
		});

		it("should make POST request with body", async () => {
			const mockResponse = { success: true };
			const requestBody = { name: "test" };

			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse
			});

			const result = await api.post("/test", requestBody);
			expect(result).toEqual(mockResponse);
			expect(global.fetch).toHaveBeenCalled();
		});

		it("should handle request errors", async () => {
			(global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

			try {
				await api.get("/test");
				expect.fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.message).toBe("Network error");
			}
		});

		it("should handle 401 Unauthorized", async () => {
			const callback = vi.fn();
			api.setUnauthorizedCallback(callback);

			(global.fetch as any).mockResolvedValueOnce({
				ok: false,
				status: 401,
				json: async () => ({ error: "Unauthorized" })
			});

			try {
				await api.get("/test");
			} catch (error) {
				// Error is expected
			}

			expect(callback).toHaveBeenCalled();
		});
	});
});
