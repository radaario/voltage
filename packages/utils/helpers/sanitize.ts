import { config } from "@voltage/config";

/**
 * Sanitize sensitive fields from objects
 * Recursively removes sensitive fields from nested objects and arrays
 * @param data Data to sanitize (object, array, string, or primitive)
 * @param sensitiveFields Additional sensitive field names to remove
 * @returns Sanitized data
 */
export function sanitizeData(data: any, sensitiveFields: string[] = []): any {
	// Handle null or undefined
	if (data === null || data === undefined) return data;

	// Handle string - try to parse as JSON
	if (typeof data === "string") {
		try {
			const parsed = JSON.parse(data);
			return sanitizeData(parsed, sensitiveFields);
		} catch (err) {
			return data; // Return as is if not valid JSON
		}
	}

	// Handle primitive types
	if (typeof data !== "object") return data;

	// Get core sensitive fields from config
	const coreSensitiveFields: string[] = config.api.sensitive_fields ? config.api.sensitive_fields.split(",").map((f) => f.trim()) : [];
	const allSensitiveFields = [...coreSensitiveFields, ...sensitiveFields];

	// Handle arrays
	if (Array.isArray(data)) {
		return data.map((item: any) => sanitizeData(item, sensitiveFields));
	}

	// Handle objects
	const sanitized: any = {};

	for (const key in data) {
		if (data.hasOwnProperty(key)) {
			// Skip sensitive fields
			if (allSensitiveFields.includes(key)) {
				continue;
			}

			// Recursively sanitize nested objects and arrays
			sanitized[key] = sanitizeData(data[key], sensitiveFields);
		}
	}

	return sanitized;
}
