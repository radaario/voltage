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
			reporter: ["text", "json", "html"],
			exclude: ["**/node_modules/**", "**/dist/**", "**/__tests__/**", "**/*.test.ts"]
		}
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./"),
			"@voltage/core": path.resolve(__dirname, "../../packages/core"),
			"@voltage/utils": path.resolve(__dirname, "../../packages/utils")
		}
	}
});
