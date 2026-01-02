import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
	plugins: [react()],
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/__tests__/setup.ts"],
		include: ["**/__tests__/**/*.test.{ts,tsx}", "**/*.test.{ts,tsx}"],
		exclude: ["**/node_modules/**", "**/dist/**", "**/build/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html", "lcov"],
			exclude: [
				"**/node_modules/**",
				"**/dist/**",
				"**/build/**",
				"**/__tests__/**",
				"**/*.test.{ts,tsx}",
				"**/*.config.ts",
				"**/types/**",
				"**/mocks/**"
			]
		}
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src")
		}
	}
});
