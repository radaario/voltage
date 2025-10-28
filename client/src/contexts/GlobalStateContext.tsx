import React, { createContext, useContext, useLayoutEffect, useState } from "react";
import localStorageUtil from "@/utils/localStorage";
import { isEmpty } from "lodash";
import localStorage from "@/utils/localStorage";

export const GlobalStateContext = createContext<any>({});
export const useGlobalStateContext = () => useContext(GlobalStateContext);
export const GlobalStateContextConsumer = GlobalStateContext.Consumer;

export function GlobalStateProvider({ children }: { children: React.ReactNode }) {
	// states
	const [isLoading, setLoading] = useState(false);
	const [isLoggedIn, setLoggedIn] = useState(false);
	const [isOpenJsonPrettierModal, setOpenJsonPrettierModal] = useState(false);
	const [authToken, setAuthToken] = useState(localStorage.get("authToken") || "");
	const [currentScreenDimension, setCurrentScreenDimension] = useState("desktop");
	const [isPopupStyleChecked, setPopupStyleChecked] = useState(localStorageUtil.get("popup_mode", { boolean: true, defaultValue: true }));

	// effects
	// useLayoutEffect(() => {
	// 	// no auth token
	// 	if (isEmpty(authToken)) {
	// 		// if there is an active socket
	// 		if (socket) {
	// 			// disconnect
	// 			socket.disconnect();
	// 		}
	// 		return;
	// 	}

	// 	const socketUrlObject = new URL(import.meta.env.VITE_SOCKET_URL);
	// 	const _socket = io(socketUrlObject.origin, {
	// 		path: socketUrlObject.pathname !== "/" ? socketUrlObject.pathname : undefined,
	// 		auth: {
	// 			authToken: authToken
	// 		},
	// 		reconnectionDelayMax: 3000
	// 	});

	// 	setSocket(_socket);

	// 	// actions
	// 	const onConnect = () => {
	// 		console.log("Socket connected!");
	// 		setConnected(true);
	// 		setAppReady(true);
	// 	};

	// 	const onDisconnect = () => {
	// 		console.log("Socket disconnected!");
	// 		setConnected(false);
	// 		setAppReady(false);
	// 	};

	// 	const onConnectError = (err: any) => {
	// 		console.log("Socket connect error!");
	// 		if (err === "unauthorized") {
	// 			setLoggedIn(false);
	// 			localStorage.remove("authToken");
	// 		}
	// 		setAppReady(false);
	// 	};

	// 	const onSignIn = (loggedIn: boolean) => {
	// 		if (isBoolean(loggedIn)) {
	// 			setLoggedIn(loggedIn);
	// 		}
	// 	};

	// 	// listeners
	// 	_socket.on(SOCKET_EVENTS.connect, onConnect);
	// 	_socket.on(SOCKET_EVENTS.disconnect, onDisconnect);
	// 	_socket.on(SOCKET_EVENTS.connect_error, onConnectError);
	// 	_socket.on(SOCKET_EVENTS.CLIENT.GET_SIGNIN_RESULT, onSignIn);

	// 	return () => {
	// 		_socket.off(SOCKET_EVENTS.connect, onConnect);
	// 		_socket.off(SOCKET_EVENTS.disconnect, onDisconnect);
	// 		_socket.off(SOCKET_EVENTS.connect_error, onConnectError);
	// 		_socket.off(SOCKET_EVENTS.CLIENT.GET_SIGNIN_RESULT, onSignIn);
	// 		_socket.disconnect();
	// 	};
	// }, [authToken]);

	useLayoutEffect(() => {
		if (!isEmpty(authToken)) {
			setLoggedIn(true);
		}
	}, [setLoggedIn]);

	// actions
	const signOut = () => {
		setLoggedIn(false);
		setAuthToken(null);
		// setSocket(null);
		// socket && socket.disconnect();
	};

	const context = {
		// states
		// socket,
		currentScreenDimension,
		setCurrentScreenDimension,
		isLoading,
		setLoading,
		isPopupStyleChecked,
		setPopupStyleChecked,
		isLoggedIn,
		setLoggedIn,
		setAuthToken,
		isOpenJsonPrettierModal,
		setOpenJsonPrettierModal,

		// actions
		signOut
	};

	return <GlobalStateContext.Provider value={context}>{children}</GlobalStateContext.Provider>;
}
