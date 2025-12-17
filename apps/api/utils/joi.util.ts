import BaseJoi, { CustomHelpers, Extension } from "joi";

/*
const stringExtension: Extension = {
	type: "string",
	base: BaseJoi.string(),
	rules: {}
};
*/

/*
const numberExtension: Extension = {
	type: "number",
	base: BaseJoi.number(),
	rules: {}
};
*/

const anyExtension: Extension = {
	type: "any",
	base: BaseJoi.any(),
	rules: {
		range: {
			method(min: number, max: number, fallback?: number) {
				return this.$_addRule({
					name: "range",
					args: { min, max, fallback }
				});
			},
			args: ["min", "max", "fallback"],
			validate(value, helpers, args) {
				value = Number(value) || 0;

				if (args.min !== undefined && args.min !== null && value < args.min) {
					return args.fallback !== undefined ? args.fallback : args.min;
				}

				if (args.max !== undefined && args.max !== null && value > args.max) {
					return args.fallback !== undefined ? args.fallback : args.max;
				}

				return value;
			}
		},
		framerate: {
			method() {
				return this.$_addRule({
					name: "framerate"
				});
			},
			validate(value, helpers) {
				// Convert to string and remove spaces
				let str = String(value).replace(/\s+/g, "").toLowerCase();

				// Extract numeric part and fps unit (if present)
				const match = str.match(/^(\d+(?:\.\d+)?)(fps|f)?$/);
				if (!match) {
					// If no match, try to parse as number
					const num = parseFloat(str);
					return isNaN(num) ? value : num;
				}

				const [, numStr] = match;
				return parseFloat(numStr);
			}
		},
		bitrate: {
			method() {
				return this.$_addRule({
					name: "bitrate"
				});
			},
			validate(value, helpers) {
				// Convert to string and remove spaces
				let str = String(value).replace(/\s+/g, "").toLowerCase();

				// Extract numeric part and unit
				const match = str.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
				if (!match) {
					// If no match, try to parse as number
					const num = parseFloat(str);
					return isNaN(num) ? value : num;
				}

				const [, numStr, unit] = match;
				let num = parseFloat(numStr);

				// Convert to base number (integer)
				if (unit === "k") {
					num *= 1000;
				} else if (unit === "m") {
					num *= 1000000;
				}

				return Math.floor(num);
			}
		},
		samplerate: {
			method() {
				return this.$_addRule({
					name: "samplerate"
				});
			},
			validate(value, helpers) {
				// Convert to string and remove spaces
				let str = String(value).replace(/\s+/g, "").toLowerCase();

				// Extract numeric part and unit (khz, hz)
				const match = str.match(/^(\d+(?:\.\d+)?)(k|khz|hz)?$/);
				if (!match) {
					// If no match, try to parse as number
					const num = parseFloat(str);
					return isNaN(num) ? value : num;
				}

				const [, numStr, unit] = match;
				let num = parseFloat(numStr);

				// Convert to Hz (base number)
				if (unit === "k" || unit === "khz") {
					num *= 1000;
				}

				return Math.floor(num);
			}
		},
		constantcase: {
			method() {
				return this.$_addRule({
					name: "constantcase"
				});
			},
			validate(value, helpers) {
				if (typeof value !== "string") {
					return value;
				}
				return value
					.trim()
					.toUpperCase()
					.replace(/[^A-Z0-9]+/g, "_");
			}
		},
		validOrDefault: {
			method(validValues: readonly string[], defaultValue?: string | number) {
				return this.$_addRule({
					name: "validOrDefault",
					args: { validValues, defaultValue }
				}).default(defaultValue !== undefined && defaultValue !== null && defaultValue !== "" ? defaultValue : validValues[0]);
			},
			args: ["validValues", "defaultValue"],
			validate(value, helpers, args) {
				const defaultValue =
					args.defaultValue !== undefined && args.defaultValue !== null && args.defaultValue !== ""
						? args.defaultValue
						: args.validValues[0];

				if (value === undefined) {
					return defaultValue;
				}

				if (args.validValues && !args.validValues.includes(value)) {
					return defaultValue;
				}

				return value;
			}
		},
		validOrStrip: {
			method(validValues: readonly string[]) {
				return this.$_addRule({
					name: "validOrStrip",
					args: { validValues }
				});
			},
			args: ["validValues"],
			validate(value, helpers, args) {
				if (args.validValues && !args.validValues.includes(value)) {
					return undefined;
				}

				return value;
			}
		}
	}
};

// export const Joi = BaseJoi.extend(stringExtension).extend(numberExtension).extend(anyExtension);
export const Joi = BaseJoi.extend(anyExtension);
