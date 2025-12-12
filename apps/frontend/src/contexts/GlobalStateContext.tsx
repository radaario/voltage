import React, { createContext, useContext, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, localStorage } from "@/utils";

// Simplified config interface for frontend - matches backend Config type structure
interface StorageConfig {
	type?: string;
	endpoint?: string;
	bucket?: string;
	region?: string;
	base_path?: string;
	[key: string]: unknown;
}

interface DatabaseConfig {
	type?: string;
	host?: string;
	port?: number;
	name?: string;
	table_prefix?: string;
	[key: string]: unknown;
}

interface ApiConfig {
	is_disabled?: boolean;
	url?: string;
	node_port?: number;
	key?: string | null;
	[key: string]: unknown;
}

interface FrontendConfig {
	is_authentication_required?: boolean;
	password?: string | null;
	data_refetch_interval?: number;
	datetime_format?: string;
	local_storage?: {
		prefix?: string | null;
	};
}

interface UtilsConfig {
	ffmpeg?: { path?: string };
	ffprobe?: { path?: string };
	nsfw?: {
		is_disabled?: boolean;
		model?: string;
		threshold?: number;
		[key: string]: unknown;
	};
	whisper?: {
		model?: string;
		cuda?: boolean;
	};
	[key: string]: unknown;
}

interface RuntimeConfig {
	is_disabled?: boolean;
	key_method?: string;
	workers?: {
		per_cpu_core?: number;
		max?: number;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

interface JobsConfig {
	queue_timeout?: number;
	process_interval?: number;
	enqueue_limit?: number;
	retention?: number;
	try_max?: number;
	retry_in?: number;
	[key: string]: unknown;
}

interface NotificationsConfig {
	process_interval?: number;
	timeout?: number;
	try_max?: number;
	retry_in?: number;
	[key: string]: unknown;
}

interface LogsConfig {
	is_disabled?: boolean;
	retention?: number;
	[key: string]: unknown;
}

interface Config {
	[key: string]: unknown;
	name?: string;
	version?: string;
	env?: string;
	port?: number;
	timezone?: string;
	temp_dir?: string;
	storage?: StorageConfig;
	database?: DatabaseConfig;
	api?: ApiConfig;
	frontend?: FrontendConfig;
	utils?: UtilsConfig;
	instances?: RuntimeConfig;
	workers?: RuntimeConfig["workers"];
	jobs?: JobsConfig;
	notifications?: NotificationsConfig;
	logs?: LogsConfig;
}

interface GlobalStateContextType {
	currentScreenDimension: string;
	setCurrentScreenDimension: (dimension: string) => void;
	isLoading: boolean;
	setLoading: (loading: boolean) => void;
	config?: Config;
	configLoading: boolean;
	configError: Error | null;
	refetchConfig: () => void;
	pageResetCounters: number;
	resetPage: () => void;
}

export const GlobalStateContext = createContext<GlobalStateContextType>({} as GlobalStateContextType);
export const useGlobalStateContext = () => useContext(GlobalStateContext);
export const GlobalStateContextConsumer = GlobalStateContext.Consumer;

export function GlobalStateProvider({ children }: { children: React.ReactNode }) {
	// states
	const [isLoading, setLoading] = useState(false);
	const [currentScreenDimension, setCurrentScreenDimension] = useState("desktop");
	const [pageResetCounters, setPageResetCounters] = useState<number>(0);

	const resetPage = () => {
		setPageResetCounters((prev) => prev + 1);
	};

	// queries
	const {
		data: configData,
		isLoading: configLoading,
		error: configError,
		refetch: refetchConfig
	} = useQuery({
		queryKey: ["config"],
		queryFn: () =>
			api.get<Config>(`/config`, {
				token: localStorage.get("authToken")
			}),
		staleTime: 5 * 60 * 1000, // accept fresh for 5 minutes
		gcTime: 10 * 60 * 1000, // keep in cache for 10 minutes
		refetchOnWindowFocus: false,
		refetchOnMount: false,
		refetchOnReconnect: false,
		refetchInterval: false
	});

	// context value
	const context: GlobalStateContextType = {
		currentScreenDimension,
		setCurrentScreenDimension,
		isLoading,
		setLoading,
		config: configData?.data,
		configLoading,
		configError,
		refetchConfig,
		pageResetCounters,
		resetPage
	};

	return <GlobalStateContext.Provider value={context}>{children}</GlobalStateContext.Provider>;
}
