import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

interface ModalStackItem {
	id: string;
	zIndex: number;
}

interface ModalContextType {
	registerModal: (id: string) => number;
	unregisterModal: (id: string) => void;
	getModalIndex: (id: string) => number;
	getModalStackPosition: (id: string) => number;
	isTopModal: (id: string) => boolean;
	hasOpenModals: boolean;
	modalCount: number;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

const BASE_Z_INDEX = 50;
const Z_INDEX_INCREMENT = 10;

export function ModalProvider({ children }: { children: ReactNode }) {
	// states
	const [modalStack, setModalStack] = useState<ModalStackItem[]>([]);

	// actions
	const registerModal = useCallback((id: string): number => {
		let zIndex = BASE_Z_INDEX;

		setModalStack((prev) => {
			// Check if modal already exists
			const existingModal = prev.find((m) => m.id === id);
			if (existingModal) {
				return prev;
			}

			// Calculate z-index based on stack position
			zIndex = BASE_Z_INDEX + prev.length * Z_INDEX_INCREMENT;
			const newModal: ModalStackItem = { id, zIndex };

			return [...prev, newModal];
		});

		return zIndex;
	}, []);

	const unregisterModal = useCallback((id: string) => {
		setModalStack((prev) => {
			const filtered = prev.filter((m) => m.id !== id);
			return filtered;
		});
	}, []);

	const getModalIndex = useCallback(
		(id: string): number => {
			const modal = modalStack.find((m) => m.id === id);
			return modal?.zIndex ?? BASE_Z_INDEX;
		},
		[modalStack]
	);

	const getModalStackPosition = useCallback(
		(id: string): number => {
			const index = modalStack.findIndex((m) => m.id === id);
			return index >= 0 ? index : 0;
		},
		[modalStack]
	);

	const isTopModal = useCallback(
		(id: string): boolean => {
			if (modalStack.length === 0) return false;
			return modalStack[modalStack.length - 1].id === id;
		},
		[modalStack]
	);

	// effects
	useEffect(() => {
		if (modalStack.length > 0) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}

		return () => {
			if (modalStack.length === 0) {
				document.body.style.overflow = "";
			}
		};
	}, [modalStack.length]);

	const value: ModalContextType = {
		registerModal,
		unregisterModal,
		getModalIndex,
		getModalStackPosition,
		isTopModal,
		hasOpenModals: modalStack.length > 0,
		modalCount: modalStack.length
	};

	return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export function useModalContext() {
	const context = useContext(ModalContext);
	if (!context) {
		throw new Error("useModalContext must be used within a ModalProvider");
	}
	return context;
}
