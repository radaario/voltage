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
	const [modalStack, setModalStack] = useState<ModalStackItem[]>([]);

	// Register a new modal and return its z-index
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

	// Unregister a modal
	const unregisterModal = useCallback((id: string) => {
		setModalStack((prev) => {
			const filtered = prev.filter((m) => m.id !== id);
			return filtered;
		});
	}, []);

	// Get the z-index for a specific modal
	const getModalIndex = useCallback(
		(id: string): number => {
			const modal = modalStack.find((m) => m.id === id);
			return modal?.zIndex ?? BASE_Z_INDEX;
		},
		[modalStack]
	);

	// Get the stack position (0 = first, 1 = second, etc.)
	const getModalStackPosition = useCallback(
		(id: string): number => {
			const index = modalStack.findIndex((m) => m.id === id);
			return index >= 0 ? index : 0;
		},
		[modalStack]
	);

	// Check if a modal is the topmost modal
	const isTopModal = useCallback(
		(id: string): boolean => {
			if (modalStack.length === 0) return false;
			return modalStack[modalStack.length - 1].id === id;
		},
		[modalStack]
	);

	// Manage body overflow based on modal count
	useEffect(() => {
		if (modalStack.length > 0) {
			// Prevent body scroll when modals are open
			document.body.style.overflow = "hidden";
		} else {
			// Restore body scroll when all modals are closed
			document.body.style.overflow = "";
		}

		return () => {
			// Cleanup on unmount
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
