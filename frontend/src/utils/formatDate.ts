import moment from "moment";
import "moment-timezone";

/**
 * Formats a date string to a readable format
 * Converts from server timezone to browser timezone
 * @param date - Date string or Date object
 * @param serverTimezone - Server timezone (from config), defaults to UTC
 * @returns Formatted date string
 */
export function formatDate(date: string | Date, serverTimezone: string = "UTC"): string {
	try {
		// Parse the date assuming it's in the server's timezone
		const momentDate = moment.tz(date, serverTimezone);

		// Convert to browser's local timezone
		const localDate = momentDate.clone().tz(moment.tz.guess());

		// Format: Jan 05, 2025 14:30:45
		return localDate.format("MMM DD, YYYY HH:mm:ss");
	} catch (error) {
		// Fallback to simple formatting if timezone conversion fails
		const d = new Date(date);
		const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		const month = months[d.getMonth()];
		const day = d.getDate().toString().padStart(2, "0");
		const year = d.getFullYear();
		const hours = d.getHours().toString().padStart(2, "0");
		const minutes = d.getMinutes().toString().padStart(2, "0");
		const seconds = d.getSeconds().toString().padStart(2, "0");
		return `${month} ${day}, ${year} ${hours}:${minutes}:${seconds}`;
	}
}

/**
 * Converts a date from server timezone to browser timezone
 * Returns a Date object
 * @param date - Date string or Date object
 * @param serverTimezone - Server timezone (from config), defaults to UTC
 * @returns Date object in browser's local timezone
 */
export function convertToLocalDate(date: string | Date, serverTimezone: string = "UTC"): Date {
	try {
		// Parse the date assuming it's in the server's timezone
		const momentDate = moment.tz(date, serverTimezone);

		// Convert to browser's local timezone and return as Date object
		return momentDate.clone().tz(moment.tz.guess()).toDate();
	} catch (error) {
		// Fallback to simple Date parsing
		return new Date(date);
	}
}
