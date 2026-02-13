/**
 * Centralized formatting utilities for the frontend application
 * Contains all format helpers for numbers, dates, bytes, percentages, etc.
 */

// Re-export date formatting functions
export { formatDate, convertToLocalDate, formatDuration, formatReadableDuration, formatDatesToDuration } from "./formatDate";

// Re-export time ago function
export { timeAgo } from "./timeAgo";

/**
 * Format bytes to gigabytes with 2 decimal places
 * @param bytes - The number of bytes
 * @returns Formatted string (e.g., "4.50 GB")
 */
export const formatBytes = (bytes: number): string => {
	const gb = bytes / 1024 ** 3;
	return `${gb.toFixed(2)} GB`;
};

/**
 * Format a number as percentage with 1 decimal place
 * @param value - The percentage value (0-100)
 * @returns Formatted string (e.g., "85.5%")
 */
export const formatPercent = (value: number): string => {
	return `${value.toFixed(1)}%`;
};

/**
 * Format MHz to GHz with 2 decimal places
 * @param mhz - Frequency in MHz
 * @returns Formatted string (e.g., "3.20 GHz")
 */
export const formatMHz = (mhz: number): string => {
	const ghz = mhz / 1000;
	return `${ghz.toFixed(2)} GHz`;
};

/**
 * Format bytes to human-readable size (auto-selects unit)
 * @param bytes - The number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1.5 MB", "2.3 GB")
 */
export const formatBytesAuto = (bytes: number, decimals: number = 2): string => {
	if (bytes === 0) return "0 Bytes";

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

/**
 * Format a number with thousand separators
 * @param value - The number to format
 * @returns Formatted string (e.g., "1,234,567")
 */
export const formatNumber = (value: number): string => {
	return value.toLocaleString();
};

/**
 * Format CPU frequency (handles both MHz and GHz inputs)
 * @param frequency - Frequency value
 * @param unit - Input unit ('mhz' or 'ghz')
 * @returns Formatted string in GHz
 */
export const formatCpuFrequency = (frequency: number, unit: "mhz" | "ghz" = "mhz"): string => {
	const ghz = unit === "mhz" ? frequency / 1000 : frequency;
	return `${ghz.toFixed(2)} GHz`;
};
