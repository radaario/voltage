import { appConfig } from "@voltage/config";

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
	const coreSensitiveFields: string[] = appConfig.api.sensitive_fields
		? appConfig.api.sensitive_fields.split(",").map((f) => f.trim())
		: [];
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

export function validateValue(value: any, type: string, defaultValue?: any, validValues?: any): any {
	// Return default value if value is null or undefined
	if (value === null || value === undefined || value === "") {
		return defaultValue !== undefined ? defaultValue : undefined;
	}

	// Type validation and conversion
	switch (type.toUpperCase()) {
		case "STRING":
			value = String(value);
			break;
		case "COSTANT":
			value = value.toUpperCase().replace(/[ -]/g, "_");
			break;
		case "NUMBER":
			value = Number(value);
			if (isNaN(value)) {
				return defaultValue !== undefined ? defaultValue : undefined;
			}
			break;
		case "INTEGER":
			value = parseInt(value, 10);
			if (isNaN(value)) {
				return defaultValue !== undefined ? defaultValue : undefined;
			}
			break;
		case "FLOAT":
			value = parseFloat(value);
			if (isNaN(value)) {
				return defaultValue !== undefined ? defaultValue : undefined;
			}
			break;
		case "PERCENT":
			value = parseFloat(value);

			if (isNaN(value)) {
				return defaultValue !== undefined ? defaultValue : undefined;
			}

			if (value < 0) {
				return 0;
			}
			if (value > 100) {
				return 100;
			}

			break;
		case "BOOLEAN":
			if (typeof value === "string") {
				value = value.toLowerCase() === "true" || value === "1";
			} else {
				value = Boolean(value);
			}
			break;
		case "ARRAY":
			if (!Array.isArray(value)) {
				return defaultValue !== undefined ? defaultValue : undefined;
			}
			break;
		case "OBJECT":
			if (typeof value !== "object" || Array.isArray(value)) {
				return defaultValue !== undefined ? defaultValue : undefined;
			}
			break;
		default:
			// No type conversion for unknown types
			break;
	}

	// Validate against allowed values if provided
	if (validValues !== undefined) {
		if (Array.isArray(validValues)) {
			if (!validValues.includes(value)) {
				return defaultValue !== undefined ? defaultValue : undefined;
			}
		} else if (typeof validValues === "object") {
			// For object validation (min/max ranges)
			if (validValues.min !== undefined && value < validValues.min) {
				return validValues.min;
			}
			if (validValues.max !== undefined && value > validValues.max) {
				return validValues.max;
			}
		}
	}

	return value;
}

export function toConstantCase(value: any): any {
	if (value === null || value === undefined) return value;
	return value.trim().toUpperCase().replace(/[ -]/g, "_");
}

export function toPercent(value: any): any {
	if (value === null || value === undefined) return value;
	const num = parseFloat(value);
	if (isNaN(num) || num < 0) return 0;
	if (num > 100) return 100;
	return num;
}
