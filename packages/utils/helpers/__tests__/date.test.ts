import { describe, it, expect, beforeEach } from "vitest";
import { getDate, getNow, addNow, addThis, subtractNow, subtractFrom, DEFAULT_DATE_FORMAT } from "../date";
import moment from "moment-timezone";

describe("Date Helpers", () => {
	describe("getDate", () => {
		it("should format date with default format", () => {
			const input = "2024-01-15 10:30:45";
			const result = getDate(input);
			expect(result).toContain("2024-01-15");
		});

		it("should format date with custom format", () => {
			const input = "2024-01-15 10:30:45";
			const result = getDate(input, "YYYY-MM-DD");
			expect(result).toBe("2024-01-15");
		});

		it("should format date with time only", () => {
			const input = "2024-01-15 10:30:45";
			const result = getDate(input, "HH:mm:ss");
			expect(result).toBe("10:30:45");
		});

		it("should handle ISO date strings", () => {
			const input = "2024-01-15T10:30:45.000Z";
			const result = getDate(input, "YYYY-MM-DD");
			expect(result).toContain("2024-01-15");
		});

		it("should handle different date formats", () => {
			const input = "01/15/2024";
			const result = getDate(input, "YYYY-MM-DD");
			expect(result).toBe("2024-01-15");
		});
	});

	describe("getNow", () => {
		it("should return current date with default format", () => {
			const result = getNow();
			expect(typeof result).toBe("string");
			expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}/);
		});

		it("should return current date with custom format", () => {
			const result = getNow("YYYY-MM-DD");
			expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
		});

		it("should return valid date that can be parsed", () => {
			const result = getNow();
			const parsed = moment(result);
			expect(parsed.isValid()).toBe(true);
		});

		it("should return time in specified format", () => {
			const result = getNow("HH:mm");
			expect(result).toMatch(/\d{2}:\d{2}/);
		});

		it("should return ISO format when requested", () => {
			const result = getNow("YYYY-MM-DDTHH:mm:ss.SSSZ");
			expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}/);
		});
	});

	describe("addNow", () => {
		it("should add minutes to current time", () => {
			const result = addNow(30, "minutes", "YYYY-MM-DD HH:mm");

			// Result should be a valid date string
			expect(result).toBeTruthy();
			expect(typeof result).toBe("string");

			// Should be parseable by moment
			const resultMoment = moment(result, "YYYY-MM-DD HH:mm");
			expect(resultMoment.isValid()).toBe(true);
		});

		it("should add hours to current time", () => {
			const result = addNow(2, "hours", "YYYY-MM-DD HH");
			expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}/);
		});

		it("should add days to current time", () => {
			const now = moment();
			const result = addNow(7, "days", "YYYY-MM-DD");
			const expected = now.add(7, "days").format("YYYY-MM-DD");

			// Allow 1 day difference
			const resultMoment = moment(result, "YYYY-MM-DD");
			const expectedMoment = moment(expected, "YYYY-MM-DD");
			const diff = Math.abs(resultMoment.diff(expectedMoment, "days"));
			expect(diff).toBeLessThanOrEqual(1);
		});

		it("should handle negative values", () => {
			const result = addNow(-1, "days", "YYYY-MM-DD");
			expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
		});
	});

	describe("addThis", () => {
		it("should add minutes to specific date", () => {
			const date = "2024-01-15 10:00:00";
			const result = addThis(date, 30, "minutes", "YYYY-MM-DD HH:mm");
			expect(result).toBe("2024-01-15 10:30");
		});

		it("should add hours to specific date", () => {
			const date = "2024-01-15 10:00:00";
			const result = addThis(date, 5, "hours", "YYYY-MM-DD HH:mm");
			expect(result).toBe("2024-01-15 15:00");
		});

		it("should add days and cross month boundary", () => {
			const date = "2024-01-30 10:00:00";
			const result = addThis(date, 5, "days", "YYYY-MM-DD");
			expect(result).toBe("2024-02-04");
		});

		it("should handle leap year", () => {
			const date = "2024-02-28 00:00:00";
			const result = addThis(date, 1, "days", "YYYY-MM-DD");
			expect(result).toBe("2024-02-29");
		});

		it("should add months", () => {
			const date = "2024-01-15 00:00:00";
			const result = addThis(date, 3, "months", "YYYY-MM-DD");
			expect(result).toBe("2024-04-15");
		});
	});

	describe("subtractNow", () => {
		it("should subtract minutes from current time", () => {
			const result = subtractNow(30, "minutes", "YYYY-MM-DD HH:mm");
			expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
		});

		it("should subtract days from current time", () => {
			const result = subtractNow(7, "days", "YYYY-MM-DD");
			expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
		});

		it("should handle negative values", () => {
			const result = subtractNow(-1, "days", "YYYY-MM-DD");
			expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
		});
	});

	describe("subtractFrom", () => {
		it("should subtract minutes from specific date", () => {
			const date = "2024-01-15 10:30:00";
			const result = subtractFrom(date, 30, "minutes", "YYYY-MM-DD HH:mm");
			expect(result).toBe("2024-01-15 10:00");
		});

		it("should subtract hours from specific date", () => {
			const date = "2024-01-15 15:00:00";
			const result = subtractFrom(date, 5, "hours", "YYYY-MM-DD HH:mm");
			expect(result).toBe("2024-01-15 10:00");
		});

		it("should subtract days and cross month boundary", () => {
			const date = "2024-02-04 10:00:00";
			const result = subtractFrom(date, 5, "days", "YYYY-MM-DD");
			expect(result).toBe("2024-01-30");
		});

		it("should handle year boundary", () => {
			const date = "2024-01-05 00:00:00";
			const result = subtractFrom(date, 10, "days", "YYYY-MM-DD");
			expect(result).toBe("2023-12-26");
		});
	});

	describe("DEFAULT_DATE_FORMAT", () => {
		it("should be defined", () => {
			expect(DEFAULT_DATE_FORMAT).toBeDefined();
		});

		it("should be a valid format string", () => {
			const testDate = moment().format(DEFAULT_DATE_FORMAT);
			expect(testDate).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}/);
		});
	});
});
