/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_PASSWORD?: string;
	// diğer VITE_ environment variables'ları buraya ekleyebilirsiniz
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
