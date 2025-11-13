import React, { createContext, useContext, useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface DashboardConfig {
	is_authentication_required?: boolean;
	password?: string;
}

interface Config {
	name?: string;
	version?: string;
	env?: string;
	port?: number;
	timezone?: string;
	temp_folder?: string;
	storage?: any;
	database?: any;
	api?: any;
	dashboard?: DashboardConfig;
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
}

export const GlobalStateContext = createContext<GlobalStateContextType>({} as GlobalStateContextType);
export const useGlobalStateContext = () => useContext(GlobalStateContext);
export const GlobalStateContextConsumer = GlobalStateContext.Consumer;

export function GlobalStateProvider({ children }: { children: React.ReactNode }) {
	// states
	const [isLoading, setLoading] = useState(false);
	const [currentScreenDimension, setCurrentScreenDimension] = useState("desktop");

	// Fetch config from backend
	const {
		data: configData,
		isLoading: configLoading,
		error: configError,
		refetch: refetchConfig
	} = useQuery({
		queryKey: ["config"],
		queryFn: async () => {
			const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/config`);
			if (!response.ok) {
				throw new Error("Failed to fetch config");
			}
			const result = await response.json();
			return result.data as Config;
		},
		staleTime: 5 * 60 * 1000, // Config 5 dakika boyunca fresh kabul edilir
		refetchOnWindowFocus: false // Pencere focus olduğunda otomatik refetch etme
	});

	// actions

	// effects

	const context: GlobalStateContextType = {
		// states
		currentScreenDimension,
		setCurrentScreenDimension,
		isLoading,
		setLoading,
		config: configData,
		configLoading,
		configError,
		refetchConfig

		// actions
	};

	return <GlobalStateContext.Provider value={context}>{children}</GlobalStateContext.Provider>;
}
