import { describe, it, expect, beforeEach, vi } from "vitest";
import { sanitizeData } from "../sanitize";

// Mock the config module
vi.mock("@voltage/core/config", () => ({
	config: {
		api: {
			sensitive_fields: "password,secret,token"
		}
	}
}));

describe("Sanitize Helpers", () => {
	describe("sanitizeData", () => {
		it("should remove sensitive fields from object", () => {
			const data = {
				username: "john",
				password: "secret123",
				email: "john@example.com"
			};

			const result = sanitizeData(data);

			expect(result).toHaveProperty("username");
			expect(result).toHaveProperty("email");
			expect(result).not.toHaveProperty("password");
		});

		it("should handle null input", () => {
			const result = sanitizeData(null);
			expect(result).toBe(null);
		});

		it("should handle undefined input", () => {
			const result = sanitizeData(undefined);
			expect(result).toBe(undefined);
		});

		it("should handle primitive types", () => {
			expect(sanitizeData(42)).toBe(42);
			expect(sanitizeData(true)).toBe(true);
			expect(sanitizeData("hello")).toBe("hello");
		});

		it("should sanitize nested objects", () => {
			const data = {
				user: {
					name: "John",
					password: "secret",
					profile: {
						bio: "Developer",
						token: "abc123"
					}
				}
			};

			const result = sanitizeData(data);

			expect(result.user).toHaveProperty("name");
			expect(result.user).not.toHaveProperty("password");
			expect(result.user.profile).toHaveProperty("bio");
			expect(result.user.profile).not.toHaveProperty("token");
		});

		it("should sanitize arrays of objects", () => {
			const data = [
				{ id: 1, name: "User1", password: "pass1" },
				{ id: 2, name: "User2", secret: "secret2" }
			];

			const result = sanitizeData(data);

			expect(result).toHaveLength(2);
			expect(result[0]).toHaveProperty("name");
			expect(result[0]).not.toHaveProperty("password");
			expect(result[1]).toHaveProperty("name");
			expect(result[1]).not.toHaveProperty("secret");
		});

		it("should handle mixed nested structures", () => {
			const data = {
				users: [
					{
						id: 1,
						credentials: {
							username: "john",
							password: "secret"
						}
					}
				]
			};

			const result = sanitizeData(data);

			expect(result.users[0].credentials).toHaveProperty("username");
			expect(result.users[0].credentials).not.toHaveProperty("password");
		});

		it("should handle additional sensitive fields parameter", () => {
			const data = {
				name: "John",
				password: "secret",
				apiKey: "abc123",
				custom_secret: "sensitive"
			};

			const result = sanitizeData(data, ["apiKey", "custom_secret"]);

			expect(result).toHaveProperty("name");
			expect(result).not.toHaveProperty("password");
			expect(result).not.toHaveProperty("apiKey");
			expect(result).not.toHaveProperty("custom_secret");
		});

		it("should parse and sanitize JSON strings", () => {
			const jsonString = JSON.stringify({
				username: "john",
				password: "secret"
			});

			const result = sanitizeData(jsonString);

			expect(result).toHaveProperty("username");
			expect(result).not.toHaveProperty("password");
		});

		it("should return string as-is if not valid JSON", () => {
			const invalidJson = "not a json string";
			const result = sanitizeData(invalidJson);
			expect(result).toBe(invalidJson);
		});

		it("should handle empty objects", () => {
			const result = sanitizeData({});
			expect(result).toEqual({});
		});

		it("should handle empty arrays", () => {
			const result = sanitizeData([]);
			expect(result).toEqual([]);
		});

		it("should preserve non-sensitive fields", () => {
			const data = {
				id: 123,
				name: "Test",
				email: "test@example.com",
				created_at: "2024-01-01",
				is_active: true,
				count: 42
			};

			const result = sanitizeData(data);

			expect(result).toEqual(data);
		});

		it("should handle circular-safe objects", () => {
			const data = {
				name: "John",
				password: "secret",
				age: 30
			};

			const result = sanitizeData(data);

			expect(result.name).toBe("John");
			expect(result.age).toBe(30);
			expect(result).not.toHaveProperty("password");
		});

		it("should handle objects with undefined values", () => {
			const data = {
				name: "John",
				password: undefined,
				email: "john@example.com"
			};

			const result = sanitizeData(data);

			expect(result).toHaveProperty("name");
			expect(result).toHaveProperty("email");
			// password key should not exist at all
			expect(result).not.toHaveProperty("password");
		});
	});
});
