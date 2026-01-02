import { beforeAll, afterEach, afterAll } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Cleanup after each test
afterEach(() => {
	cleanup();
});

// Mock window.matchMedia
beforeAll(() => {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => true
		})
	});

	// Mock IntersectionObserver
	global.IntersectionObserver = class IntersectionObserver {
		constructor() {}
		disconnect() {}
		observe() {}
		takeRecords() {
			return [];
		}
		unobserve() {}
	} as any;
});
