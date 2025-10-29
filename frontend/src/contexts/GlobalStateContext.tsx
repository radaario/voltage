import React, { createContext, useContext, useState } from "react";

export const GlobalStateContext = createContext<any>({});
export const useGlobalStateContext = () => useContext(GlobalStateContext);
export const GlobalStateContextConsumer = GlobalStateContext.Consumer;

export function GlobalStateProvider({ children }: { children: React.ReactNode }) {
	// states
	const [isLoading, setLoading] = useState(false);
	const [currentScreenDimension, setCurrentScreenDimension] = useState("desktop");

	// actions

	// effects

	const context = {
		// states
		currentScreenDimension,
		setCurrentScreenDimension,
		isLoading,
		setLoading

		// actions
	};

	return <GlobalStateContext.Provider value={context}>{children}</GlobalStateContext.Provider>;
}
