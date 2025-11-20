import { useEffect, useState } from "react";
import { XMarkIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface DeleteConfirmModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title?: string;
	message?: React.ReactNode;
	confirmText?: string;
	isDeleting?: boolean;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
	isOpen,
	onClose,
	onConfirm,
	title = "Confirm Delete",
	message = "Are you sure you want to delete this item? This action cannot be undone.",
	confirmText = "Delete",
	isDeleting = false
}) => {
	const [isAnimating, setIsAnimating] = useState(false);
	const [shouldRender, setShouldRender] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setShouldRender(true);
			// Get scrollbar width before hiding
			const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
			document.body.style.overflow = "hidden";
			document.body.style.paddingRight = `${scrollbarWidth}px`;
			// Trigger animation after render
			setTimeout(() => setIsAnimating(true), 10);
		} else {
			setIsAnimating(false);
			document.body.style.overflow = "unset";
			document.body.style.paddingRight = "";
			// Wait for animation to finish before unmounting
			const timer = setTimeout(() => setShouldRender(false), 300);
			return () => clearTimeout(timer);
		}

		return () => {
			document.body.style.overflow = "unset";
			document.body.style.paddingRight = "";
		};
	}, [isOpen]);

	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !isDeleting) {
				handleClose();
			}
		};

		if (isOpen) {
			window.addEventListener("keydown", handleEscape);
		}

		return () => {
			window.removeEventListener("keydown", handleEscape);
		};
	}, [isOpen, isDeleting, onClose]);

	const handleClose = () => {
		if (!isDeleting) {
			setIsAnimating(false);
			setTimeout(() => {
				onClose();
			}, 300);
		}
	};

	if (!shouldRender) return null;

	return (
		<div className="fixed inset-0 z-50 overflow-y-auto">
			{/* Backdrop */}
			<div
				className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
					isAnimating ? "opacity-100" : "opacity-0"
				}`}
				onClick={isDeleting ? undefined : handleClose}
			/>

			{/* Modal Container */}
			<div className="flex min-h-full items-end sm:items-center justify-center p-4">
				{/* Modal Panel */}
				<div
					className={`relative w-full max-w-lg bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-6 z-10 transition-all duration-300 ${
						isAnimating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
					}`}>
					<div className="flex items-start gap-4">
						{/* Icon */}
						<div className="shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
							<ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
						</div>

						{/* Content */}
						<div className="flex-1 min-w-0">
							<div className="flex items-start justify-between">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
								{!isDeleting && (
									<button
										type="button"
										onClick={handleClose}
										className="ml-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
										<XMarkIcon className="h-5 w-5" />
									</button>
								)}
							</div>
							<div className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message}</div>
						</div>
					</div>

					{/* Actions */}
					<div className="mt-6 flex flex-wrap justify-end gap-3">
						<button
							type="button"
							onClick={handleClose}
							disabled={isDeleting}
							className="px-4 py-2 bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
							Cancel
						</button>
						<button
							type="button"
							onClick={onConfirm}
							disabled={isDeleting}
							className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
							{isDeleting && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />}
							{isDeleting ? "Deleting..." : confirmText}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default DeleteConfirmModal;
