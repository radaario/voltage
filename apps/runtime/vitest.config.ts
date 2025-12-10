import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["**/__tests__/**/*.test.ts"],
		testTimeout: 15000, // Longer timeout for FFmpeg/TensorFlow mocks
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: ["node_modules/", "dist/", "**/__tests__/**", "**/*.config.ts", "index.ts"]
		}
	}
});
