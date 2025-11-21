import { ExclamationTriangleIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import Modal from "@/components/base/Modal/Modal";
import Button from "@/components/base/Button/Button";

export type ConfirmModalVariant = "danger" | "warning" | "info";

interface ConfirmModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title?: string;
	message?: React.ReactNode;
	confirmText?: string;
	cancelText?: string;
	variant?: ConfirmModalVariant;
	isLoading?: boolean;
	loadingText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
	isOpen,
	onClose,
	onConfirm,
	title = "Confirm Action",
	message = "Are you sure you want to proceed with this action?",
	confirmText = "Confirm",
	cancelText = "Cancel",
	variant = "warning",
	isLoading = false,
	loadingText
}) => {
	// Variant-based styling
	const variantConfig = {
		danger: {
			iconBg: "bg-red-100 dark:bg-red-900/20",
			iconColor: "text-red-600 dark:text-red-400",
			icon: ExclamationTriangleIcon,
			buttonBg: "bg-red-600 hover:bg-red-700",
			buttonText: "text-white"
		},
		warning: {
			iconBg: "bg-yellow-100 dark:bg-yellow-900/20",
			iconColor: "text-yellow-600 dark:text-yellow-400",
			icon: ExclamationTriangleIcon,
			buttonBg: "bg-yellow-600 hover:bg-yellow-700",
			buttonText: "text-white"
		},
		info: {
			iconBg: "bg-blue-100 dark:bg-blue-900/20",
			iconColor: "text-blue-600 dark:text-blue-400",
			icon: ArrowUturnLeftIcon,
			buttonBg: "bg-blue-600 hover:bg-blue-700",
			buttonText: "text-white"
		}
	};

	const config = variantConfig[variant];
	const IconComponent = config.icon;

	const handleClose = () => {
		if (!isLoading) {
			onClose();
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			size="lg"
			closeOnBackdrop={!isLoading}
			closeOnEscape={!isLoading}
			id="ConfirmModal">
			<Modal.Content noPadding>
				<div className="p-6">
					<div className="flex items-start gap-4">
						{/* Icon */}
						<div className={`shrink-0 w-12 h-12 rounded-full ${config.iconBg} flex items-center justify-center`}>
							<IconComponent className={`h-6 w-6 ${config.iconColor}`} />
						</div>

						{/* Content */}
						<div className="flex-1 min-w-0">
							<h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
							<div className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message}</div>
						</div>
					</div>
				</div>
			</Modal.Content>
			<Modal.Footer>
				<Button
					variant="ghost"
					onClick={handleClose}
					disabled={isLoading}>
					{cancelText}
				</Button>
				<button
					type="button"
					onClick={onConfirm}
					disabled={isLoading}
					className={`px-4 py-2 rounded-lg ${config.buttonBg} ${config.buttonText} transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}>
					{isLoading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />}
					{isLoading ? loadingText || `${confirmText}...` : confirmText}
				</button>
			</Modal.Footer>
		</Modal>
	);
};

export default ConfirmModal;
