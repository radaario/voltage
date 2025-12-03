import dotenv from "dotenv";
import fs from "fs";
import path from "path";

/**
 * Loads environment variables from .env files
 * Priority (later files override earlier ones):
 * 1. .env (base)
 * 2. .env.local (local overrides)
 * 3. .env.{VOLTAGE_ENV} (environment-specific)
 */
export function loadEnvironmentFiles(): void {
	const workspaceRoot = path.resolve(process.cwd(), "../..");

	// Define env files to load (in order of priority)
	const envFiles = [".env", ".env.local"];

	// Add environment-specific file if VOLTAGE_ENV is set
	const voltageEnv = process.env.VOLTAGE_ENV?.toLowerCase();
	if (voltageEnv && !envFiles.includes(`.env.${voltageEnv}`)) {
		envFiles.push(`.env.${voltageEnv}`);
	}

	// Load each env file
	for (const envFile of envFiles) {
		const envPath = path.resolve(workspaceRoot, envFile);

		if (fs.existsSync(envPath)) {
			dotenv.config({ path: envPath, override: true });

			// Log in development/local environments only
			if (process.env.VOLTAGE_ENV === "local" || process.env.NODE_ENV === "development") {
				console.log(`[CONFIG] Loaded: ${envFile}`);
			}
		}
	}
}

/**
 * Helper to safely get environment variable with fallback
 */
export function getEnv(key: string, fallback: string = ""): string {
	return process.env[key] ?? fallback;
}

/**
 * Helper to get number from environment variable with fallback
 */
export function getEnvNumber(key: string, fallback: number): number {
	const value = process.env[key];
	if (!value) return fallback;

	const parsed = Number(value);
	return isNaN(parsed) ? fallback : parsed;
}

/**
 * Helper to get boolean from environment variable
 */
export function getEnvBoolean(key: string, fallback: boolean = false): boolean {
	const value = process.env[key];
	if (!value) return fallback;

	return value.toLowerCase() === "true";
}
