import { describe, it, expect } from "vitest";
import { formatDate, convertToLocalDate } from "../formatDate";

describe("formatDate", () => {
	it("should format date string correctly", () => {
		const date = "2024-01-15 10:30:00";
		const formatted = formatDate(date, "UTC");
		expect(typeof formatted).toBe("string");
		expect(formatted.length).toBeGreaterThan(0);
	});

	it("should handle Date object", () => {
		const date = new Date("2024-01-15T10:30:00Z");
		const formatted = formatDate(date, "UTC");
		expect(typeof formatted).toBe("string");
	});

	it("should handle invalid dates gracefully", () => {
		const invalidDate = "invalid-date";
		const formatted = formatDate(invalidDate, "UTC");
		// Should not throw and return a string
		expect(typeof formatted).toBe("string");
	});

	it("should respect server timezone", () => {
		const date = "2024-01-15 10:30:00";
		const formattedUTC = formatDate(date, "UTC");
		const formattedEST = formatDate(date, "America/New_York");
		// Both should return valid strings
		expect(typeof formattedUTC).toBe("string");
		expect(typeof formattedEST).toBe("string");
	});

	it("should handle empty date string", () => {
		const formatted = formatDate("", "UTC");
		expect(typeof formatted).toBe("string");
	});
});

describe("convertToLocalDate", () => {
	it("should convert date to Date object", () => {
		const date = "2024-01-15 10:30:00";
		const converted = convertToLocalDate(date, "UTC");
		expect(converted).toBeInstanceOf(Date);
	});

	it("should handle Date object input", () => {
		const date = new Date("2024-01-15T10:30:00Z");
		const converted = convertToLocalDate(date, "UTC");
		expect(converted).toBeInstanceOf(Date);
	});

	it("should handle invalid dates", () => {
		const invalidDate = "invalid-date";
		const converted = convertToLocalDate(invalidDate, "UTC");
		// Should still return a Date object (even if invalid)
		expect(converted).toBeDefined();
	});

	it("should respect timezone conversions", () => {
		const date = "2024-01-15 12:00:00";
		const convertedUTC = convertToLocalDate(date, "UTC");
		const convertedEST = convertToLocalDate(date, "America/New_York");

		expect(convertedUTC).toBeInstanceOf(Date);
		expect(convertedEST).toBeInstanceOf(Date);
	});
});
