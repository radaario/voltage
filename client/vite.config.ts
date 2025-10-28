import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
	// Load env file based on `mode` in the current working directory.
	// Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
	const newMode = process.env.APP_ENV ? `${process.env.APP_ENV}`.trim() : undefined;
	const env = loadEnv(newMode, process.cwd(), ""); // test|prod

	return {
		plugins: [react()],
		base: env.VITE_APP_BASE || "",
		mode: newMode,
		server: {
			port: 4000
		},
		build: {
			outDir: "../client-build",
			sourcemap: false
		},
		resolve: {
			mainFields: [],
			alias: {
				"socket.io-client": "socket.io-client/dist/socket.io.js",
				"@": path.resolve(__dirname, "./src")
			}
		}
	}
});
