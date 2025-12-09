import { config } from "@voltage/config";
import moment from "moment-timezone";

// Set default format for moment
moment.defaultFormat = "YYYY-MM-DD HH:mm:ss.SSS";

/**
 * Default date format
 */
export const DEFAULT_DATE_FORMAT = "YYYY-MM-DD HH:mm:ss.SSS";

/**
 * Format a date string
 * @param date Date string to format
 * @param format Output format (default: YYYY-MM-DD HH:mm:ss.SSS)
 * @returns Formatted date string
 */
export function getDate(date: string, format: string = DEFAULT_DATE_FORMAT): string {
	const m = moment(date);
	return m.format(format).toString();
}

/**
 * Get current date/time with optional timezone
 * @param format Output format (default: YYYY-MM-DD HH:mm:ss.SSS)
 * @returns Formatted current date string
 */
export function getNow(format: string = DEFAULT_DATE_FORMAT): string {
	let m = moment();

	if (config.timezone && config.timezone !== "") {
		try {
			m = m.tz(config.timezone);
		} catch (error) {
			// Invalid timezone — fall back to local moment
		}
	}

	return m.format(format).toString();
}

/**
 * Add duration to current date
 * @param amount Amount to add
 * @param unit Unit of time (e.g., 'minutes', 'hours', 'days')
 * @param format Output format
 * @returns Formatted date string
 */
export function addNow(amount: number, unit: moment.unitOfTime.DurationConstructor, format: string = DEFAULT_DATE_FORMAT): string {
	return addThis(getNow(), amount, unit, format);
}

/**
 * Add duration to a specific date
 * @param date Date string
 * @param amount Amount to add
 * @param unit Unit of time
 * @param format Output format
 * @returns Formatted date string
 */
export function addThis(
	date: string,
	amount: number,
	unit: moment.unitOfTime.DurationConstructor,
	format: string = DEFAULT_DATE_FORMAT
): string {
	const m = moment(date);
	return m.add(amount, unit).format(format).toString();
}

/**
 * Subtract duration from current date
 * @param amount Amount to subtract
 * @param unit Unit of time
 * @param format Output format
 * @returns Formatted date string
 */
export function subtractNow(amount: number, unit: moment.unitOfTime.DurationConstructor, format: string = DEFAULT_DATE_FORMAT): string {
	return subtractFrom(getNow(), amount, unit, format);
}

/**
 * Subtract duration from a specific date
 * @param date Date string
 * @param amount Amount to subtract
 * @param unit Unit of time
 * @param format Output format
 * @returns Formatted date string
 */
export function subtractFrom(
	date: string,
	amount: number,
	unit: moment.unitOfTime.DurationConstructor,
	format: string = DEFAULT_DATE_FORMAT
): string {
	const m = moment(date);
	return m.subtract(amount, unit).format(format).toString();
}
