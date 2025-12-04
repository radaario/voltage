import { ExclamationTriangleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { Modal, Button } from "@/components";

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
	noIcon?: boolean;
	size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
	loadingText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
	isOpen,
	onClose,
	onConfirm,
	size = "lg",
	title = "Confirm Action",
	message = "Are you sure you want to proceed with this action?",
	confirmText = "Confirm",
	cancelText = "Cancel",
	variant = "warning",
	noIcon = false,
	isLoading = false,
	loadingText
}) => {
	// Variant-based styling
	const variantConfig = {
		danger: {
			iconBg: "bg-red-100 dark:bg-red-900/20",
			iconColor: "text-red-600 dark:text-red-400",
			icon: ExclamationTriangleIcon,
			buttonVariant: "danger" as const
		},
		warning: {
			iconBg: "bg-yellow-100 dark:bg-yellow-900/20",
			iconColor: "text-yellow-600 dark:text-yellow-400",
			icon: ExclamationTriangleIcon,
			buttonVariant: "warning" as const
		},
		info: {
			iconBg: "bg-blue-100 dark:bg-blue-900/20",
			iconColor: "text-blue-600 dark:text-blue-400",
			icon: ArrowPathIcon,
			buttonVariant: "primary" as const
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
			size={size}
			closeOnBackdrop={!isLoading}
			closeOnEscape={!isLoading}
			data-modal-id="ConfirmModal">
			<Modal.Content noPadding>
				<div className="p-6">
					<div className="flex items-start gap-4">
						{/* Icon */}
						{!noIcon && (
							<div className={`shrink-0 w-12 h-12 rounded-full ${config.iconBg} flex items-center justify-center`}>
								<IconComponent className={`h-6 w-6 ${config.iconColor}`} />
							</div>
						)}

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
					size="sm"
					onClick={handleClose}
					disabled={isLoading}>
					{cancelText}
				</Button>
				<Button
					variant={config.buttonVariant}
					size="sm"
					className="min-w-21"
					isLoading={isLoading}
					onClick={onConfirm}
					disabled={isLoading}>
					{isLoading ? loadingText || `${confirmText}...` : confirmText}
				</Button>
			</Modal.Footer>
		</Modal>
	);
};

export default ConfirmModal;
