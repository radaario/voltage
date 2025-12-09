import { useEffect, useId, useState, useCallback } from "react";
import { useModalContext } from "@/contexts/ModalContext";

interface UseModalOptions {
	isOpen: boolean;
	onClose?: () => void;
	id?: string;
}

export function useModal({ isOpen, onClose, id }: UseModalOptions) {
	const autoId = useId();
	const modalId = id || autoId;
	const { registerModal, unregisterModal, getModalIndex, getModalStackPosition, isTopModal } = useModalContext();
	const [zIndex, setZIndex] = useState<number>(50);
	const [stackPosition, setStackPosition] = useState<number>(0);
	const [isAnimating, setIsAnimating] = useState(false);
	const [shouldRender, setShouldRender] = useState(false);

	// Register modal on mount and handle open/close animations
	useEffect(() => {
		if (isOpen) {
			setShouldRender(true);
			setIsAnimating(false); // Start with animation disabled
			const index = registerModal(modalId);
			setZIndex(index);
			// Trigger animation after a brief delay to ensure DOM is ready
			const timer = requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					setIsAnimating(true);
				});
			});

			return () => {
				cancelAnimationFrame(timer);
			};
		} else {
			setIsAnimating(false);
			// Wait for animation to complete before unmounting
			const timeout = setTimeout(() => {
				setShouldRender(false);
			}, 130); // Match transition duration

			return () => clearTimeout(timeout);
		}
	}, [isOpen, modalId, registerModal]);

	// Unregister modal only on unmount
	useEffect(() => {
		return () => {
			unregisterModal(modalId);
		};
	}, [modalId, unregisterModal]);

	// Update z-index when it changes in context
	useEffect(() => {
		if (isOpen) {
			const currentIndex = getModalIndex(modalId);
			const currentPosition = getModalStackPosition(modalId);
			setZIndex(currentIndex);
			setStackPosition(currentPosition);
		}
	}, [isOpen, modalId, getModalIndex, getModalStackPosition]);

	// Handle close - trigger animation first, then call onClose after delay
	const handleClose = useCallback(() => {
		if (isTopModal(modalId)) {
			// Trigger closing animation immediately
			setIsAnimating(false);
			// Call onClose after animation duration
			if (onClose) {
				const timer = setTimeout(() => {
					onClose();
				}, 130);
				// Note: We can't cleanup this timeout because the component will unmount
				// but it's safe because onClose typically triggers navigation/unmount anyway
				return timer;
			}
		} else {
			onClose && onClose();
		}
	}, [modalId, isTopModal, onClose]);

	// Handle backdrop click
	const handleBackdropClick = useCallback(() => {
		handleClose();
	}, [handleClose]);

	// Handle ESC key - only if this is the top modal
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isOpen) {
				// Check if this modal is on top at the moment of key press
				if (isTopModal(modalId)) {
					e.preventDefault();
					handleClose();
				}
			}
		};

		if (isOpen) {
			document.addEventListener("keydown", handleEscape);
			return () => document.removeEventListener("keydown", handleEscape);
		}
	}, [isOpen, modalId, isTopModal, handleClose]);

	return {
		id: modalId,
		zIndex,
		stackPosition,
		isAnimating,
		shouldRender,
		isTopModal: isTopModal(modalId),
		handleClose,
		handleBackdropClick
	};
}
