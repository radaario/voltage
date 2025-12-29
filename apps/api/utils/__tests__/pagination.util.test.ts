import { describe, it, expect } from "vitest";
import { getPaginationParams } from "../pagination.util";

describe("Pagination Util", () => {
	describe("getPaginationParams", () => {
		it("should return default values when no query params provided", () => {
			const req = { query: {} } as any;
			const result = getPaginationParams(req);

			expect(result).toEqual({
				limit: 25,
				page: 1,
				offset: 0
			});
		});

		it("should use custom default limit", () => {
			const req = { query: {} } as any;
			const result = getPaginationParams(req, 50);

			expect(result.limit).toBe(50);
		});

		it("should parse valid limit and page from query", () => {
			const req = { query: { limit: "10", page: "3" } } as any;
			const result = getPaginationParams(req);

			expect(result).toEqual({
				limit: 10,
				page: 3,
				offset: 20 // (3-1) * 10
			});
		});

		it("should handle limit as number", () => {
			const req = { query: { limit: 15 } } as any;
			const result = getPaginationParams(req);

			expect(result.limit).toBe(15);
		});

		it("should use default limit for invalid limit values", () => {
			const testCases = [
				{ query: { limit: "invalid" } },
				{ query: { limit: "-5" } },
				{ query: { limit: "0" } },
				{ query: { limit: "" } }
			];

			testCases.forEach((req) => {
				const result = getPaginationParams(req as any);
				expect(result.limit).toBe(25);
			});
		});

		it("should use page 1 for invalid page values", () => {
			const testCases = [
				{ query: { page: "invalid" } },
				{ query: { page: "-1" } },
				{ query: { page: "0" } },
				{ query: { page: "" } }
			];

			testCases.forEach((req) => {
				const result = getPaginationParams(req as any);
				expect(result.page).toBe(1);
				expect(result.offset).toBe(0);
			});
		});

		it("should calculate correct offset", () => {
			const testCases = [
				{ limit: 10, page: 1, expectedOffset: 0 },
				{ limit: 10, page: 2, expectedOffset: 10 },
				{ limit: 25, page: 3, expectedOffset: 50 },
				{ limit: 50, page: 5, expectedOffset: 200 }
			];

			testCases.forEach(({ limit, page, expectedOffset }) => {
				const req = { query: { limit: String(limit), page: String(page) } } as any;
				const result = getPaginationParams(req);

				expect(result.offset).toBe(expectedOffset);
			});
		});

		it("should handle large page numbers", () => {
			const req = { query: { limit: "10", page: "1000" } } as any;
			const result = getPaginationParams(req);

			expect(result.page).toBe(1000);
			expect(result.offset).toBe(9990);
		});

		it("should handle decimal values by parsing as integer", () => {
			const req = { query: { limit: "10.5", page: "2.9" } } as any;
			const result = getPaginationParams(req);

			expect(result.limit).toBe(10);
			expect(result.page).toBe(2);
		});
	});
});
