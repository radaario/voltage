import { ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useModal } from "@/hooks/useModal";
import { Modal, Button, Tooltip } from "@/components";

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
	const handleClose = () => {
		if (!isDeleting) {
			onClose();
		}
	};

	useModal({ isOpen, onClose: handleClose, id: "DeleteConfirmModal" });

	if (!isOpen) return null;

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			size="lg">
			<Modal.Content>
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
								<Tooltip content="Close">
									<Button
										variant="ghost"
										size="sm"
										iconOnly
										onClick={handleClose}
										className="ml-2">
										<XMarkIcon className="h-6 w-6" />
									</Button>
								</Tooltip>
							)}
						</div>
						<div className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message}</div>
					</div>
				</div>
			</Modal.Content>

			<Modal.Footer>
				<div className="flex justify-end gap-3">
					<Button
						variant="secondary"
						onClick={handleClose}
						disabled={isDeleting}>
						Cancel
					</Button>
					<Button
						variant="danger"
						onClick={onConfirm}
						disabled={isDeleting}>
						{isDeleting && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />}
						{isDeleting ? "Deleting..." : confirmText}
					</Button>
				</div>
			</Modal.Footer>
		</Modal>
	);
};

export default DeleteConfirmModal;
