import React, { createContext, useContext, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/utils";

interface FrontendConfig {
	is_authentication_required?: boolean;
	password?: string;
}

interface Config {
	name?: string;
	version?: string;
	env?: string;
	port?: number;
	timezone?: string;
	temp_dir?: string;
	storage?: any;
	database?: any;
	api?: any;
	frontend?: FrontendConfig;
	utils?: any;
	instances?: any;
	workers?: any;
	jobs?: any;
	notifications?: any;
	logs?: any;
}

interface GlobalStateContextType {
	currentScreenDimension: string;
	setCurrentScreenDimension: (dimension: string) => void;
	isLoading: boolean;
	setLoading: (loading: boolean) => void;
	config?: Config;
	configLoading: boolean;
	configError: any;
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
		queryFn: () => api.get<Config>("/config"),
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
