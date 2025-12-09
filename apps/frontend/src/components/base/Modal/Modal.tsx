import { ReactNode, useMemo } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useModal } from "@/hooks/useModal";
import { useModalContext } from "@/contexts/ModalContext";

interface ModalProps {
	isOpen?: boolean;
	onClose: () => void;
	children: ReactNode;
	size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full";
	height?: "" | "sm" | "md" | "lg" | "xl";
	closeOnBackdrop?: boolean;
	closeOnEscape?: boolean;
	id?: string;
	// Internal props from useModal/useRouteModal
	zIndex?: number;
	isAnimating?: boolean;
	shouldRender?: boolean;
	handleBackdropClick?: () => void;
}

interface ModalHeaderProps {
	children: ReactNode;
	onClose?: () => void;
	showCloseButton?: boolean;
}

interface ModalContentProps {
	children: ReactNode;
	className?: string;
	noPadding?: boolean;
}

interface ModalFooterProps {
	children: ReactNode;
	className?: string;
}

const sizeClasses = {
	sm: "max-w-sm",
	md: "max-w-md",
	lg: "max-w-lg",
	xl: "max-w-xl",
	"2xl": "max-w-2xl",
	"3xl": "max-w-3xl",
	"4xl": "max-w-4xl",
	"5xl": "max-w-5xl",
	full: "max-w-full mx-4"
};

const heightClasses = {
	sm: "h-[50vh]",
	md: "h-[59vh]",
	lg: "h-[72.5vh]",
	xl: "h-[85vh]"
};

// Size downgrade mapping for stacked modals
const sizeDowngradeMap: Record<string, Array<"sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full">> = {
	"5xl": ["5xl", "4xl", "3xl", "2xl"],
	"4xl": ["4xl", "3xl", "2xl", "xl"],
	"3xl": ["3xl", "2xl", "xl", "lg"],
	"2xl": ["2xl", "xl", "lg", "md"],
	xl: ["xl", "lg", "md", "sm"],
	lg: ["lg", "md", "sm", "sm"],
	md: ["md", "sm", "sm", "sm"],
	sm: ["sm", "sm", "sm", "sm"],
	full: ["full", "5xl", "4xl", "3xl"]
};

// Height downgrade mapping for stacked modals
const heightDowngradeMap: Record<string, Array<"" | "sm" | "md" | "lg" | "xl">> = {
	xl: ["xl", "lg", "md", "sm"],
	lg: ["lg", "md", "sm", "sm"],
	md: ["md", "sm", "sm", "sm"],
	sm: ["sm", "sm", "sm", "sm"],
	"": ["", "", "", ""]
};

function Modal({
	isOpen = true,
	onClose,
	children,
	size = "2xl",
	height = "",
	closeOnBackdrop = true,
	closeOnEscape = true,
	id,
	// External modal props (from useRouteModal or direct useModal)
	zIndex: externalZIndex,
	isAnimating: externalIsAnimating,
	shouldRender: externalShouldRender,
	handleBackdropClick: externalHandleBackdropClick
}: ModalProps) {
	// Only use internal useModal if external props are not provided
	const internalModalProps = useModal({
		isOpen,
		onClose: closeOnEscape ? onClose : undefined,
		id
	});

	// Use external props if provided, otherwise use internal
	const shouldUseExternal = externalZIndex !== undefined;
	const zIndex = shouldUseExternal ? externalZIndex : internalModalProps.zIndex;
	const isAnimating = shouldUseExternal ? externalIsAnimating : internalModalProps.isAnimating;
	const shouldRender = shouldUseExternal ? externalShouldRender : internalModalProps.shouldRender;
	const handleBackdropClick = shouldUseExternal ? externalHandleBackdropClick : internalModalProps.handleBackdropClick;

	// Get modal stack position for auto-sizing
	const { getModalStackPosition } = useModalContext();
	const stackPosition = id ? getModalStackPosition(id) : 0;

	// Calculate adjusted size and height based on stack position
	const adjustedSize = useMemo(() => {
		const sizeMap = sizeDowngradeMap[size] || [size];
		const index = Math.min(stackPosition, sizeMap.length - 1);
		return sizeMap[index];
	}, [size, stackPosition]);

	const adjustedHeight = useMemo(() => {
		const heightMap = heightDowngradeMap[height] || [height];
		const index = Math.min(stackPosition, heightMap.length - 1);
		return heightMap[index];
	}, [height, stackPosition]);

	if (!shouldRender) return null;

	const handleBackdropClickInternal = () => {
		if (closeOnBackdrop) {
			handleBackdropClick?.();
		}
	};

	const ModalContent = (
		<div
			data-modal-id={id}
			className="fixed inset-0 overflow-y-auto"
			style={{ zIndex }}>
			{/* Backdrop */}
			<div
				className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
					isAnimating ? "opacity-100" : "opacity-0"
				}`}
				onClick={handleBackdropClickInternal}
			/>

			{/* Modal Container */}
			<div className="flex min-h-full items-center justify-center p-4">
				{/* Modal Panel */}
				<div
					className={`relative w-full ${sizeClasses[adjustedSize]} ${adjustedHeight ? heightClasses[adjustedHeight] : ""} flex flex-col bg-white dark:bg-neutral-800 rounded-2xl shadow-xl transition-all duration-300 ${
						isAnimating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
					}`}
					onClick={(e) => e.stopPropagation()}
					style={{ zIndex: zIndex + 1 }}>
					{children}
				</div>
			</div>
		</div>
	);

	return createPortal(ModalContent, document.body);
}

function ModalHeader({ children, onClose, showCloseButton = true }: ModalHeaderProps) {
	return (
		<div className="shrink-0 flex items-center justify-between p-6 border-b border-gray-200 dark:border-neutral-700">
			<div className="flex-1 min-w-0">{children}</div>
			{showCloseButton && onClose && (
				<button
					onClick={onClose}
					className="ml-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
					aria-label="Close modal">
					<XMarkIcon className="w-5 h-5" />
				</button>
			)}
		</div>
	);
}

function ModalContent({ children, className = "", noPadding = false }: ModalContentProps) {
	return <div className={`flex-1 overflow-y-auto ${noPadding ? "" : "p-6"} ${className}`}>{children}</div>;
}

function ModalFooter({ children, className = "" }: ModalFooterProps) {
	return (
		<div
			className={`shrink-0 flex items-center justify-end gap-3 py-4.5 px-6 border-t border-gray-200 dark:border-neutral-700 ${className}`}>
			{children}
		</div>
	);
}

// Compound component pattern
Modal.Header = ModalHeader;
Modal.Content = ModalContent;
Modal.Footer = ModalFooter;

export default Modal;
