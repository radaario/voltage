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
		return localDate.format(import.meta.env.VITE_DATETIME_FORMAT || "YYYY-MM-DD HH:mm:ss");
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

/**
 * Formats a duration in seconds to a time string (MM:SS or HH:MM:SS)
 * @param seconds - Duration in seconds
 * @returns Formatted time string (00:05 for 5s, 02:30 for 2m30s, 01:20:00 for 1h20m)
 */
export const formatDuration = (seconds: number) => {
	const totalSeconds = Math.floor(seconds);
	const hrs = Math.floor(totalSeconds / 3600);
	const mins = Math.floor((totalSeconds % 3600) / 60);
	const secs = totalSeconds % 60;

	// Pad with zeros
	const pad = (num: number) => String(num).padStart(2, "0");

	// If less than 1 minute, show MM:SS
	if (hrs === 0 && mins === 0) {
		return `00:${pad(secs)}`;
	}
	// If less than 1 hour, show MM:SS
	else if (hrs === 0) {
		return `${pad(mins)}:${pad(secs)}`;
	}
	// If 1 hour or more, show HH:MM:SS
	else {
		return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
	}
};

/**
 * Formats duration in seconds to a human-readable string
 * @param durationInSeconds - Duration in seconds
 * @returns Formatted string (e.g., "5s", "2m 30s", "1h 20m") or null for invalid durations
 */
export const formatReadableDuration = (durationInSeconds: number): string | null => {
	// Negative or too large value check
	if (durationInSeconds < 0 || durationInSeconds > 86400) {
		// If more than 24 hours
		return null;
	}

	// Format the duration
	if (durationInSeconds < 60) {
		return `${Math.round(durationInSeconds)}s`;
	} else if (durationInSeconds < 3600) {
		const minutes = Math.floor(durationInSeconds / 60);
		const seconds = Math.round(durationInSeconds % 60);

		if (seconds === 0) {
			return `${minutes}m`;
		}

		return `${minutes}m ${seconds}s`;
	} else {
		const hours = Math.floor(durationInSeconds / 3600);
		const minutes = Math.floor((durationInSeconds % 3600) / 60);

		if (minutes === 0) {
			return `${hours}h`;
		}

		return `${hours}h ${minutes}m`;
	}
};

/**
 * Calculates and formats the duration between two dates
 * @param startDate - Start date string or Date object
 * @param endDate - End date string or Date object (defaults to current time if not provided)
 * @param serverTimezone - Server timezone (from config), defaults to UTC
 * @returns Formatted duration string or null if dates are invalid
 */
export const formatDatesToDuration = (
	startDate: string | Date | null | undefined,
	endDate?: string | Date | null,
	serverTimezone: string = "UTC"
): string | null => {
	// If start date is not provided, return null
	if (!startDate) {
		return null;
	}

	try {
		const start = convertToLocalDate(startDate, serverTimezone).getTime();
		const end = endDate ? convertToLocalDate(endDate, serverTimezone).getTime() : Date.now();

		// Invalid date check
		if (isNaN(start) || isNaN(end)) {
			return null;
		}

		const durationInSeconds = (end - start) / 1000;
		return formatReadableDuration(durationInSeconds);
	} catch (error) {
		return null;
	}
};
