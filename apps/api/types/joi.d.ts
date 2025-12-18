import "joi";

declare module "joi" {
	interface AnySchema {
		range(min: number, max: number): this;
		framerate(): this;
		bitrate(): this;
		samplerate(): this;
		validOrDefault<T extends readonly any[]>(validValues: T, defaultValue?: T[number]): this;
		validOrFallback<T extends readonly any[]>(validValues: T, fallback: string | number | null): this;
	}

	interface StringSchema {
		range(min: number, max: number): this;
		framerate(): this;
		bitrate(): this;
		samplerate(): this;
		constantcase(): this;
		validOrDefault<T extends readonly string[]>(validValues: T, defaultValue?: T[number]): this;
		validOrFallback<T extends readonly string[]>(validValues: T, fallback: string | number | null): this;
	}

	interface NumberSchema {
		range(min: number, max: number): this;
		framerate(): this;
		bitrate(): this;
		samplerate(): this;
		validOrDefault<T extends readonly number[]>(validValues: T, defaultValue?: T[number]): this;
		validOrFallback<T extends readonly number[]>(validValues: T, fallback: string | number | null): this;
	}

	interface ArraySchema<T = any[]> {
		compact(): this;
	}
}
