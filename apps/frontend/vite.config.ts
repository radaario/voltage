import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
	// Load env file based on `mode` in the current working directory.
	// Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
	// const newMode = process.env.VOLTAGE_ENV ? `${process.env.VOLTAGE_ENV}`.trim() : mode;
	// const env = loadEnv(newMode, process.cwd(), ""); // test|prod
	const port = Number(process.env.VOLTAGE_FRONTEND_NODE_PORT) || 3000;

	return {
		plugins: [react(), tailwindcss()],
		base: process.env.VITE_PATH || "/",
		// mode: newMode,
		server: {
			host: true,
			port: port
		},
		preview: {
			allowedHosts: true,
			port: port
		},
		build: { outDir: "./dist", sourcemap: false },
		resolve: { mainFields: [], alias: { "@": path.resolve(__dirname, "./src") } }
	};
});
