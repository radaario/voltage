import { describe, it, expect } from "vitest";
import { Joi } from "../joi.util";

describe("Joi Util Extensions", () => {
	describe("string extensions", () => {
		describe("range", () => {
			it("should clamp value to minimum", () => {
				const schema = Joi.string().range(10, 100);
				const result = schema.validate("5");

				expect(result.error).toBeUndefined();
				expect(result.value).toBe(10);
			});

			it("should clamp value to maximum", () => {
				const schema = Joi.string().range(10, 100);
				const result = schema.validate("150");

				expect(result.error).toBeUndefined();
				expect(result.value).toBe(100);
			});

			it("should allow value within range", () => {
				const schema = Joi.string().range(10, 100);
				const result = schema.validate("50");

				expect(result.error).toBeUndefined();
				expect(result.value).toBe(50);
			});
		});

		describe("framerate", () => {
			it("should parse numeric framerate", () => {
				const schema = Joi.string().framerate();
				const result = schema.validate("30");

				expect(result.error).toBeUndefined();
				expect(result.value).toBe(30);
			});

			it("should parse framerate with fps suffix", () => {
				const schema = Joi.string().framerate();
				const result = schema.validate("60fps");

				expect(result.error).toBeUndefined();
				expect(result.value).toBe(60);
			});

			it("should parse decimal framerate", () => {
				const schema = Joi.string().framerate();
				const result = schema.validate("29.97");

				expect(result.error).toBeUndefined();
				expect(result.value).toBe(29.97);
			});
		});

		describe("bitrate", () => {
			it("should parse bitrate in k", () => {
				const schema = Joi.string().bitrate();
				const result = schema.validate("500k");

				expect(result.error).toBeUndefined();
				expect(result.value).toBe(500000);
			});

			it("should parse bitrate in m", () => {
				const schema = Joi.string().bitrate();
				const result = schema.validate("5m");

				expect(result.error).toBeUndefined();
				expect(result.value).toBe(5000000);
			});
		});

		describe("constantcase", () => {
			it("should convert to constant case", () => {
				const schema = Joi.string().constantcase();
				const result = schema.validate("hello world");

				expect(result.error).toBeUndefined();
				expect(result.value).toBe("HELLO_WORLD");
			});

			it("should handle special characters", () => {
				const schema = Joi.string().constantcase();
				const result = schema.validate("test-value 123");

				expect(result.error).toBeUndefined();
				expect(result.value).toBe("TEST_VALUE_123");
			});
		});

		describe("validOrDefault", () => {
			it("should use first valid value as default", () => {
				const schema = Joi.string().validOrDefault(["option1", "option2", "option3"]);
				const result = schema.validate(undefined);

				expect(result.error).toBeUndefined();
				expect(result.value).toBe("option1");
			});

			it("should use provided default", () => {
				const schema = Joi.string().validOrDefault(["option1", "option2"], "option2");
				const result = schema.validate(undefined);

				expect(result.error).toBeUndefined();
				expect(result.value).toBe("option2");
			});

			it("should return default for invalid value", () => {
				const schema = Joi.string().validOrDefault(["option1", "option2"]);
				const result = schema.validate("invalid");

				expect(result.error).toBeUndefined();
				expect(result.value).toBe("option1");
			});

			it("should accept valid value", () => {
				const schema = Joi.string().validOrDefault(["option1", "option2"]);
				const result = schema.validate("option2");

				expect(result.error).toBeUndefined();
				expect(result.value).toBe("option2");
			});
		});
	});

	describe("number extensions", () => {
		describe("range", () => {
			it("should clamp number to minimum", () => {
				const schema = Joi.number().range(0, 100);
				const result = schema.validate(-10);

				expect(result.error).toBeUndefined();
				expect(result.value).toBe(0);
			});

			it("should clamp number to maximum", () => {
				const schema = Joi.number().range(0, 100);
				const result = schema.validate(150);

				expect(result.error).toBeUndefined();
				expect(result.value).toBe(100);
			});

			it("should allow number within range", () => {
				const schema = Joi.number().range(0, 100);
				const result = schema.validate(50);

				expect(result.error).toBeUndefined();
				expect(result.value).toBe(50);
			});
		});
	});

	describe("array extensions", () => {
		describe("compact", () => {
			it("should remove null and undefined values", () => {
				const schema = Joi.array().compact();
				const result = schema.validate([1, null, 2, undefined, 3]);

				expect(result.error).toBeUndefined();
				expect(result.value).toEqual([1, 2, 3]);
			});

			it("should keep empty strings and false values", () => {
				const schema = Joi.array().compact();
				const result = schema.validate([1, "", 2, false, 3]);

				expect(result.error).toBeUndefined();
				expect(result.value).toEqual([1, "", 2, false, 3]);
			});
		});
	});

	describe("base Joi functionality", () => {
		it("should validate required fields", () => {
			const schema = Joi.object({
				name: Joi.string().required(),
				age: Joi.number().required()
			});

			const result = schema.validate({ name: "Test" });

			expect(result.error).toBeDefined();
			expect(result.error?.message).toContain("age");
		});

		it("should validate optional fields", () => {
			const schema = Joi.object({
				name: Joi.string().required(),
				description: Joi.string().optional()
			});

			const result = schema.validate({ name: "Test" });

			expect(result.error).toBeUndefined();
		});

		it("should provide default values", () => {
			const schema = Joi.object({
				status: Joi.string().default("active")
			});

			const result = schema.validate({});

			expect(result.value.status).toBe("active");
		});

		it("should work with extended Joi", () => {
			expect(Joi).toBeDefined();
			expect(typeof Joi.string).toBe("function");
			expect(typeof Joi.number).toBe("function");
			expect(typeof Joi.array).toBe("function");
		});
	});
});
