import { describe, it, expect } from "vitest";
import { uuid, uukey, hash } from "../crypto";

describe("crypto helpers", () => {
	describe("uuid", () => {
		it("should generate a valid UUID v4", () => {
			const result = uuid();
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			expect(result).toMatch(uuidRegex);
		});

		it("should generate unique UUIDs", () => {
			const uuid1 = uuid();
			const uuid2 = uuid();
			expect(uuid1).not.toBe(uuid2);
		});
	});

	describe("uukey", () => {
		it("should generate a hashed UUID with default SHA1", () => {
			const result = uukey();
			// SHA1 produces 40 hex characters
			expect(result).toHaveLength(40);
			expect(result).toMatch(/^[0-9a-f]{40}$/i);
		});

		it("should generate hashed UUID with MD5", () => {
			const result = uukey("MD5");
			// MD5 produces 32 hex characters
			expect(result).toHaveLength(32);
			expect(result).toMatch(/^[0-9a-f]{32}$/i);
		});

		it("should generate hashed UUID with SHA256", () => {
			const result = uukey("SHA256");
			// SHA256 produces 64 hex characters
			expect(result).toHaveLength(64);
			expect(result).toMatch(/^[0-9a-f]{64}$/i);
		});

		it("should generate hashed UUID with SHA512", () => {
			const result = uukey("SHA512");
			// SHA512 produces 128 hex characters
			expect(result).toHaveLength(128);
			expect(result).toMatch(/^[0-9a-f]{128}$/i);
		});

		it("should generate unique uukeys", () => {
			const uukey1 = uukey();
			const uukey2 = uukey();
			expect(uukey1).not.toBe(uukey2);
		});
	});

	describe("hash", () => {
		const testData = "test-string";

		it("should hash with default SHA1", () => {
			const result = hash(testData);
			expect(result).toHaveLength(40);
			expect(result).toMatch(/^[0-9a-f]{40}$/i);
		});

		it("should hash with MD5", () => {
			const result = hash(testData, "MD5");
			expect(result).toHaveLength(32);
			expect(result).toBe("661f8009fa8e56a9d0e94a0a644397d7");
		});

		it("should hash with SHA1", () => {
			const result = hash(testData, "SHA1");
			expect(result).toHaveLength(40);
			expect(result).toBe("4f49d69613b186e71104c7ca1b26c1e5b78c9193");
		});

		it("should hash with SHA256", () => {
			const result = hash(testData, "SHA256");
			expect(result).toHaveLength(64);
			expect(result).toBe("ffe65f1d98fafedea3514adc956c8ada5980c6c5d2552fd61f48401aefd5c00e");
		});

		it("should hash with SHA512", () => {
			const result = hash(testData, "SHA512");
			expect(result).toHaveLength(128);
		});

		it("should produce consistent hashes for same input", () => {
			const result1 = hash(testData, "SHA256");
			const result2 = hash(testData, "SHA256");
			expect(result1).toBe(result2);
		});

		it("should produce different hashes for different inputs", () => {
			const result1 = hash("test1", "SHA256");
			const result2 = hash("test2", "SHA256");
			expect(result1).not.toBe(result2);
		});

		it("should handle empty strings", () => {
			const result = hash("", "MD5");
			expect(result).toHaveLength(32);
			expect(result).toBe("d41d8cd98f00b204e9800998ecf8427e");
		});
	});
});
