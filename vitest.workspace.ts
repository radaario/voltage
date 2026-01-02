import { defineWorkspace } from "vitest/config";
import path from "path";

export default defineWorkspace([
	{
		extends: "./vitest.config.ts",
		test: {
			name: "core",
			root: "./packages/core",
			include: ["**/__tests__/**/*.test.ts", "**/*.test.ts"]
		}
	},
	{
		extends: "./vitest.config.ts",
		test: {
			name: "utils",
			root: "./packages/utils",
			include: ["**/__tests__/**/*.test.ts", "**/*.test.ts"]
		}
	},
	{
		extends: "./vitest.config.ts",
		test: {
			name: "runtime",
			root: "./apps/runtime",
			include: ["**/__tests__/**/*.test.ts", "**/*.test.ts"]
		},
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./apps/runtime"),
				"@voltage/core": path.resolve(__dirname, "./packages/core"),
				"@voltage/utils": path.resolve(__dirname, "./packages/utils")
			}
		}
	},
	{
		extends: "./vitest.config.ts",
		test: {
			name: "api",
			root: "./apps/api",
			include: ["**/__tests__/**/*.test.ts", "**/*.test.ts"]
		},
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./apps/api"),
				"@voltage/core": path.resolve(__dirname, "./packages/core"),
				"@voltage/utils": path.resolve(__dirname, "./packages/utils")
			}
		}
	},
	{
		extends: "./vitest.config.ts",
		test: {
			name: "frontend",
			root: "./apps/frontend",
			include: ["**/__tests__/**/*.test.ts", "**/*.test.tsx"],
			environment: "jsdom"
		},
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./apps/frontend/src"),
				"@voltage/core": path.resolve(__dirname, "./packages/core"),
				"@voltage/utils": path.resolve(__dirname, "./packages/utils")
			}
		}
	}
]);
