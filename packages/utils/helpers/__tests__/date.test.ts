import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDate, getNow, addNow, addThis, subtractNow, subtractFrom, DEFAULT_DATE_FORMAT } from "../date";

// Mock the config
vi.mock("@voltage/config", () => ({
	config: {
		timezone: "America/New_York"
	}
}));

describe("date helpers", () => {
	describe("getDate", () => {
		it("should format a date with default format", () => {
			const date = "2024-01-15T10:30:45.123Z";
			const result = getDate(date);
			expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}/);
		});

		it("should format a date with custom format", () => {
			const date = "2024-01-15T10:30:45.123Z";
			const result = getDate(date, "YYYY-MM-DD");
			expect(result).toBe("2024-01-15");
		});

		it("should format date with time only", () => {
			const date = "2024-01-15T10:30:45.123Z";
			const result = getDate(date, "HH:mm:ss");
			expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
		});
	});

	describe("getNow", () => {
		it("should return current date with default format", () => {
			const result = getNow();
			expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}/);
		});

		it("should return current date with custom format", () => {
			const result = getNow("YYYY-MM-DD");
			expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
		});

		it("should apply timezone if configured", () => {
			const result = getNow();
			// Result should be a valid date string
			expect(result).toBeTruthy();
			expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}/);
		});
	});

	describe("addNow", () => {
		it("should add minutes to current time", () => {
			const now = getNow();
			const result = addNow(30, "minutes");
			expect(result).toBeTruthy();
			// Result should be greater than now
			expect(new Date(result).getTime()).toBeGreaterThan(new Date(now).getTime());
		});

		it("should add hours to current time", () => {
			const now = getNow();
			const result = addNow(2, "hours");
			expect(new Date(result).getTime()).toBeGreaterThan(new Date(now).getTime());
		});

		it("should add days to current time", () => {
			const now = getNow();
			const result = addNow(5, "days");
			expect(new Date(result).getTime()).toBeGreaterThan(new Date(now).getTime());
		});

		it("should use custom format", () => {
			const result = addNow(1, "days", "YYYY-MM-DD");
			expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
		});
	});

	describe("addThis", () => {
		it("should add duration to given date", () => {
			const baseDate = "2024-01-15 10:00:00.000";
			const result = addThis(baseDate, 30, "minutes");
			expect(result).toContain("10:30");
		});

		it("should add hours to given date", () => {
			const baseDate = "2024-01-15 10:00:00.000";
			const result = addThis(baseDate, 2, "hours");
			expect(result).toContain("12:00");
		});

		it("should add days to given date", () => {
			const baseDate = "2024-01-15 10:00:00.000";
			const result = addThis(baseDate, 1, "days");
			expect(result).toContain("2024-01-16");
		});
	});

	describe("subtractNow", () => {
		it("should subtract minutes from current time", () => {
			const now = getNow();
			const result = subtractNow(30, "minutes");
			expect(new Date(result).getTime()).toBeLessThan(new Date(now).getTime());
		});

		it("should subtract hours from current time", () => {
			const now = getNow();
			const result = subtractNow(2, "hours");
			expect(new Date(result).getTime()).toBeLessThan(new Date(now).getTime());
		});

		it("should subtract days from current time", () => {
			const now = getNow();
			const result = subtractNow(5, "days");
			expect(new Date(result).getTime()).toBeLessThan(new Date(now).getTime());
		});
	});

	describe("subtractFrom", () => {
		it("should subtract duration from given date", () => {
			const baseDate = "2024-01-15 10:30:00.000";
			const result = subtractFrom(baseDate, 30, "minutes");
			expect(result).toContain("10:00");
		});

		it("should subtract hours from given date", () => {
			const baseDate = "2024-01-15 12:00:00.000";
			const result = subtractFrom(baseDate, 2, "hours");
			expect(result).toContain("10:00");
		});

		it("should subtract days from given date", () => {
			const baseDate = "2024-01-16 10:00:00.000";
			const result = subtractFrom(baseDate, 1, "days");
			expect(result).toContain("2024-01-15");
		});
	});
});
