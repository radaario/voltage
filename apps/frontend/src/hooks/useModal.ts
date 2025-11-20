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
	const { registerModal, unregisterModal, getModalIndex, isTopModal } = useModalContext();
	const [zIndex, setZIndex] = useState(50);
	const [isAnimating, setIsAnimating] = useState(false);
	const [shouldRender, setShouldRender] = useState(false);

	// Register/unregister modal based on isOpen state
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

			// Cleanup: unregister when component unmounts or isOpen changes to false
			return () => {
				cancelAnimationFrame(timer);
				unregisterModal(modalId);
			};
		} else {
			// When isOpen becomes false, immediately unregister
			unregisterModal(modalId);
			setIsAnimating(false);
			// Wait for animation to complete before unmounting
			const timeout = setTimeout(() => {
				setShouldRender(false);
			}, 200); // Match transition duration

			return () => clearTimeout(timeout);
		}
	}, [isOpen, modalId, registerModal, unregisterModal]);

	// Update z-index when it changes in context
	useEffect(() => {
		if (isOpen) {
			const currentIndex = getModalIndex(modalId);
			setZIndex(currentIndex);
		}
	}, [isOpen, modalId, getModalIndex]);

	// Handle close - trigger animation first, then call onClose after delay
	const handleClose = useCallback(() => {
		if (isTopModal(modalId)) {
			// Trigger closing animation immediately
			setIsAnimating(false);
			// Call onClose after animation duration
			if (onClose) {
				setTimeout(() => {
					onClose();
				}, 200);
			}
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
		modalId,
		zIndex,
		isAnimating,
		shouldRender,
		isTopModal: isTopModal(modalId),
		handleClose,
		handleBackdropClick
	};
}
