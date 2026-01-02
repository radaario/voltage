import { vi } from "vitest";

/**
 * Create a mock function with type safety
 */
export function createMockFn<T extends (...args: any[]) => any>(): T {
	return vi.fn() as unknown as T;
}

/**
 * Wait for a specific amount of time
 */
export function waitFor(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a temporary environment variable for testing
 */
export function withEnv<T>(key: string, value: string | undefined, fn: () => T): T {
	const original = process.env[key];
	if (value !== undefined) {
		process.env[key] = value;
	} else {
		delete process.env[key];
	}
	try {
		return fn();
	} finally {
		if (original !== undefined) {
			process.env[key] = original;
		} else {
			delete process.env[key];
		}
	}
}

/**
 * Create multiple temporary environment variables for testing
 */
export function withEnvs<T>(envs: Record<string, string | undefined>, fn: () => T): T {
	const originals: Record<string, string | undefined> = {};
	for (const [key, value] of Object.entries(envs)) {
		originals[key] = process.env[key];
		if (value !== undefined) {
			process.env[key] = value;
		} else {
			delete process.env[key];
		}
	}
	try {
		return fn();
	} finally {
		for (const [key, original] of Object.entries(originals)) {
			if (original !== undefined) {
				process.env[key] = original;
			} else {
				delete process.env[key];
			}
		}
	}
}

/**
 * Create a mock logger for testing
 */
export function createMockLogger() {
	return {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
		success: vi.fn()
	};
}
