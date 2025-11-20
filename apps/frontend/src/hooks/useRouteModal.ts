import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useModal } from "./useModal";

interface UseRouteModalOptions {
	navigateBackTo?: string;
	id?: string;
}

export function useRouteModal(options: UseRouteModalOptions = {}) {
	const { navigateBackTo, id } = options;
	const navigate = useNavigate();
	const [isOpen, setIsOpen] = useState(true);

	const handleCloseCallback = useCallback(() => {
		setIsOpen(false);
	}, []);

	const modalProps = useModal({
		isOpen,
		onClose: handleCloseCallback,
		id
	});

	// Navigate when modal finishes closing animation
	useEffect(() => {
		if (!isOpen && !modalProps.shouldRender) {
			if (navigateBackTo) {
				navigate(navigateBackTo);
			} else {
				navigate(-1);
			}
		}
	}, [isOpen, modalProps.shouldRender, navigate, navigateBackTo]);

	return {
		...modalProps,
		onClose: handleCloseCallback,
		handleClose: modalProps.handleClose
	};
}
