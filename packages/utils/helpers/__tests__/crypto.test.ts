import { describe, it, expect } from "vitest";
import { uuid, uukey, hash } from "../crypto";

describe("Crypto Helpers", () => {
	describe("uuid", () => {
		it("should generate valid UUID v4", () => {
			const id = uuid();
			// UUID v4 regex pattern
			const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			expect(uuidPattern.test(id)).toBe(true);
		});

		it("should generate unique UUIDs", () => {
			const id1 = uuid();
			const id2 = uuid();
			expect(id1).not.toBe(id2);
		});

		it("should return string", () => {
			const id = uuid();
			expect(typeof id).toBe("string");
		});

		it("should have correct length", () => {
			const id = uuid();
			expect(id).toHaveLength(36); // 32 hex chars + 4 hyphens
		});
	});

	describe("uukey", () => {
		it("should generate hashed UUID", () => {
			const key = uukey();
			expect(typeof key).toBe("string");
			expect(key.length).toBeGreaterThan(0);
		});

		it("should generate unique keys", () => {
			const key1 = uukey();
			const key2 = uukey();
			expect(key1).not.toBe(key2);
		});

		it("should use SHA1 by default", () => {
			const key = uukey();
			// SHA1 produces 40 character hex string
			expect(key).toHaveLength(40);
		});

		it("should support MD5 algorithm", () => {
			const key = uukey("MD5");
			// MD5 produces 32 character hex string
			expect(key).toHaveLength(32);
		});

		it("should support SHA256 algorithm", () => {
			const key = uukey("SHA256");
			// SHA256 produces 64 character hex string
			expect(key).toHaveLength(64);
		});

		it("should support SHA512 algorithm", () => {
			const key = uukey("SHA512");
			// SHA512 produces 128 character hex string
			expect(key).toHaveLength(128);
		});

		it("should produce only hex characters", () => {
			const key = uukey();
			const hexPattern = /^[0-9a-f]+$/i;
			expect(hexPattern.test(key)).toBe(true);
		});
	});

	describe("hash", () => {
		const testData = "test-data-to-hash";

		it("should hash data with SHA1 by default", () => {
			const hashed = hash(testData);
			expect(hashed).toHaveLength(40);
			expect(typeof hashed).toBe("string");
		});

		it("should produce consistent hashes", () => {
			const hash1 = hash(testData);
			const hash2 = hash(testData);
			expect(hash1).toBe(hash2);
		});

		it("should produce different hashes for different data", () => {
			const hash1 = hash("data1");
			const hash2 = hash("data2");
			expect(hash1).not.toBe(hash2);
		});

		it("should support MD5 algorithm", () => {
			const hashed = hash(testData, "MD5");
			expect(hashed).toHaveLength(32);
		});

		it("should support SHA1 algorithm", () => {
			const hashed = hash(testData, "SHA1");
			expect(hashed).toHaveLength(40);
		});

		it("should support SHA256 algorithm", () => {
			const hashed = hash(testData, "SHA256");
			expect(hashed).toHaveLength(64);
		});

		it("should support SHA512 algorithm", () => {
			const hashed = hash(testData, "SHA512");
			expect(hashed).toHaveLength(128);
		});

		it("should produce only hex characters", () => {
			const hashed = hash(testData);
			const hexPattern = /^[0-9a-f]+$/i;
			expect(hexPattern.test(hashed)).toBe(true);
		});

		it("should handle empty string", () => {
			const hashed = hash("");
			expect(typeof hashed).toBe("string");
			expect(hashed.length).toBeGreaterThan(0);
		});

		it("should handle special characters", () => {
			const hashed = hash("!@#$%^&*()_+-={}[]|\\:;\"'<>,.?/");
			expect(typeof hashed).toBe("string");
			expect(hashed.length).toBeGreaterThan(0);
		});

		it("should handle unicode characters", () => {
			const hashed = hash("Hello 世界 🌍");
			expect(typeof hashed).toBe("string");
			expect(hashed.length).toBeGreaterThan(0);
		});
	});
});
