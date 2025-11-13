import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
// https://vitejs.dev/config/
export default defineConfig(function (_a) {
    var command = _a.command, mode = _a.mode;
    // Load env file based on `mode` in the current working directory.
    // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
    var newMode = process.env.APP_ENV ? "".concat(process.env.APP_ENV).trim() : undefined;
    var env = loadEnv(newMode, process.cwd(), ""); // test|prod
    return {
        plugins: [react(), tailwindcss()],
        base: env.VITE_APP_BASE || "/",
        mode: newMode,
        server: { port: 3000, host: env.NODE_ENV === "development" },
        build: { outDir: "../dist/frontend", sourcemap: false },
        resolve: { mainFields: [], alias: { "@": path.resolve(__dirname, "./src") } }
    };
});
