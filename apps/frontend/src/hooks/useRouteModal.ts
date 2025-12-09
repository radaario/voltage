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
		// navigate is stable from react-router
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen, modalProps.shouldRender, navigateBackTo]);

	return {
		...modalProps,
		onClose: handleCloseCallback,
		handleClose: modalProps.handleClose
	};
}
