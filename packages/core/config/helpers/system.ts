import os from "os";
import path from "path";
import { readFileSync } from "fs";

// Determine if the OS is Windows
export const isWindows = os.platform() === "win32";

export const cpuCoresCount = os.cpus().length || 1;

// Base paths
export const getAppDir = () => path.resolve(process.cwd(), "../..");

// Read version from root package.json
export const getAppVersion = () => {
	try {
		const rootPackageJsonPath = path.join(getAppDir(), "package.json");
		const packageJson = JSON.parse(readFileSync(rootPackageJsonPath, "utf-8"));
		return packageJson.version || "1.0.0";
	} catch (error) {
		console.warn("Failed to read version from root package.json, using default");
		return "1.0.0";
	}
};
