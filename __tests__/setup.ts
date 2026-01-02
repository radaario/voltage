import { beforeAll, afterAll, afterEach, vi } from "vitest";

// Mock environment variables for testing
beforeAll(() => {
	// Set up test environment variables
	process.env.NODE_ENV = "test";
	process.env.VOLTAGE_HOST = "localhost";
	process.env.VOLTAGE_PORT = "8080";
	process.env.VOLTAGE_DATABASE_TYPE = "SQLITE";
	process.env.VOLTAGE_DATABASE_FILENAME = ":memory:";
});

// Clean up after each test
afterEach(() => {
	vi.clearAllMocks();
	vi.restoreAllMocks();
});

// Cleanup after all tests
afterAll(() => {
	vi.clearAllTimers();
});
