import { describe, it, expect, vi, beforeEach } from "vitest";
import { sanitizeData } from "../sanitize";

// Mock the config
vi.mock("@voltage/config", () => ({
	config: {
		api: {
			sensitive_fields: "password,token,secret"
		}
	}
}));

describe("sanitize helpers", () => {
	describe("sanitizeData", () => {
		it("should remove sensitive fields from simple object", () => {
			const data = {
				username: "testuser",
				password: "secret123",
				email: "test@example.com",
				token: "abc123"
			};

			const result = sanitizeData(data);

			expect(result).toEqual({
				username: "testuser",
				email: "test@example.com"
			});
			expect(result).not.toHaveProperty("password");
			expect(result).not.toHaveProperty("token");
		});

		it("should remove sensitive fields from nested objects", () => {
			const data = {
				user: {
					username: "testuser",
					password: "secret123",
					profile: {
						name: "Test User",
						secret: "hidden"
					}
				},
				token: "abc123"
			};

			const result = sanitizeData(data);

			expect(result).toEqual({
				user: {
					username: "testuser",
					profile: {
						name: "Test User"
					}
				}
			});
		});

		it("should sanitize arrays of objects", () => {
			const data = [
				{ username: "user1", password: "pass1" },
				{ username: "user2", password: "pass2" }
			];

			const result = sanitizeData(data);

			expect(result).toEqual([{ username: "user1" }, { username: "user2" }]);
		});

		it("should sanitize nested arrays", () => {
			const data = {
				users: [
					{ username: "user1", token: "token1" },
					{ username: "user2", token: "token2" }
				]
			};

			const result = sanitizeData(data);

			expect(result).toEqual({
				users: [{ username: "user1" }, { username: "user2" }]
			});
		});

		it("should handle additional sensitive fields", () => {
			const data = {
				username: "testuser",
				password: "secret123",
				apiKey: "key123",
				customSecret: "hidden"
			};

			const result = sanitizeData(data, ["apiKey", "customSecret"]);

			expect(result).toEqual({
				username: "testuser"
			});
		});

		it("should parse and sanitize JSON strings", () => {
			const data = '{"username":"testuser","password":"secret123"}';

			const result = sanitizeData(data);

			expect(result).toEqual({
				username: "testuser"
			});
		});

		it("should return non-JSON strings as is", () => {
			const data = "plain text string";

			const result = sanitizeData(data);

			expect(result).toBe("plain text string");
		});

		it("should handle null and undefined", () => {
			expect(sanitizeData(null)).toBeNull();
			expect(sanitizeData(undefined)).toBeUndefined();
		});

		it("should handle primitive types", () => {
			expect(sanitizeData(123)).toBe(123);
			expect(sanitizeData(true)).toBe(true);
			expect(sanitizeData("string")).toBe("string");
		});

		it("should handle empty objects", () => {
			const result = sanitizeData({});
			expect(result).toEqual({});
		});

		it("should handle empty arrays", () => {
			const result = sanitizeData([]);
			expect(result).toEqual([]);
		});

		it("should handle complex nested structures", () => {
			const data = {
				level1: {
					users: [
						{
							username: "user1",
							password: "pass1",
							settings: {
								theme: "dark",
								apiKeys: [
									{ name: "key1", secret: "secret1" },
									{ name: "key2", secret: "secret2" }
								]
							}
						}
					],
					token: "admin-token"
				}
			};

			const result = sanitizeData(data);

			expect(result).toEqual({
				level1: {
					users: [
						{
							username: "user1",
							settings: {
								theme: "dark",
								apiKeys: [{ name: "key1" }, { name: "key2" }]
							}
						}
					]
				}
			});
		});
	});
});
