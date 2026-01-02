import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
		exclude: ["**/node_modules/**", "**/dist/**", "**/build/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html", "lcov"],
			exclude: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/__tests__/**", "**/*.test.ts", "**/*.config.ts", "**/types/**"]
		},
		testTimeout: 10000,
		hookTimeout: 10000
	},
	resolve: {
		alias: {
			"@voltage/core": path.resolve(__dirname, "./packages/core"),
			"@voltage/utils": path.resolve(__dirname, "./packages/utils")
		}
	}
});
