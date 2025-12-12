import pkg from "../../package.json";

interface PackageJson {
	name: string;
	version: string;
	description?: string;
	[key: string]: unknown;
}

export interface AppInfo {
	NAME: string;
	SLUG: string;
	VERSION: string;
	DESCRIPTION: string;
	BUILD_TIME: string;
	ENV: string;
	IS_DEV: boolean;
	IS_PROD: boolean;
}

export const APP: AppInfo = {
	NAME: "VOLTAGE",
	SLUG: pkg.name ?? "voltage-frontend",
	VERSION: pkg.version ?? "0.0.0",
	DESCRIPTION: (pkg as PackageJson).description ?? "",
	BUILD_TIME: new Date().toISOString(),
	ENV: import.meta.env.MODE,
	IS_DEV: import.meta.env.DEV,
	IS_PROD: import.meta.env.PROD
};

export default APP;
