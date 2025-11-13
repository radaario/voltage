import pkg from "../../package.json";

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
	DESCRIPTION: (pkg as any).description ?? "",
	BUILD_TIME: new Date().toISOString(),
	ENV: import.meta.env.MODE,
	IS_DEV: import.meta.env.DEV,
	IS_PROD: import.meta.env.PROD
};

export default APP;
