/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_PASSWORD?: string;
	readonly VITE_API_BASE_URL?: string;
	// other VITE_ environment variables can be added here
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
