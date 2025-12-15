import BaseJoi, { AnySchema, Extension, StringSchema } from "joi";

/**
 * validWithDefault rule typings
 */
interface ValidWithDefaultRule {
	validWithDefault(values: readonly string[], defaultValue: string): StringSchema;
	formatter(fn: (value: string) => string): StringSchema;
}

/**
 * Module augmentation
 */
declare module "joi" {
	interface StringSchema extends ValidWithDefaultRule {}
}

/**
 * Joi Extension
 */
const validWithDefaultExtension: Extension = {
	type: "string",
	base: BaseJoi.string(),
	rules: {
		formatter: {
			method(this: AnySchema, fn: (value: string) => string) {
				return this.$_setFlag("formatter", fn);
			},
			args: [
				{
					name: "fn",
					assert: (value) => typeof value === "function",
					message: "formatter must be a function"
				}
			],
			validate(value: any, helpers) {
				if (value === undefined || value === null) return value;
				const formatter = helpers.schema.$_getFlag("formatter");
				return formatter ? formatter(value) : value;
			}
		},
		validWithDefault: {
			method(this: AnySchema, values: readonly string[], defaultValue: string) {
				return this.$_addRule({
					name: "validWithDefault",
					args: { values, defaultValue }
				});
			},
			args: [
				{
					name: "values",
					assert: Array.isArray,
					message: "values must be an array"
				},
				{
					name: "defaultValue"
				}
			],
			validate(
				value: any,
				helpers,
				args: {
					values: readonly string[];
					defaultValue: string;
				}
			) {
				// If undefined/null, return default
				if (value === undefined || value === null) {
					return args.defaultValue;
				}

				// Check if value is in valid array
				return args.values.includes(value) ? value : args.defaultValue;
			}
		}
	}
};

const Joi = BaseJoi.extend(validWithDefaultExtension);

export default Joi;
