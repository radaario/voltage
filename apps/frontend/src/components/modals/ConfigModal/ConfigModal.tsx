import { Modal, JsonViewer, Tooltip, Button } from "@/components";
import { useModal } from "@/hooks/useModal";
import { InformationCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface ConfigModalProps {
	isOpen: boolean;
	onClose: () => void;
	config: any;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose, config }) => {
	const modalProps = useModal({ isOpen, onClose });

	return (
		<Modal
			{...modalProps}
			onClose={onClose}
			size="3xl">
			<Modal.Header
				onClose={modalProps.handleClose}
				showCloseButton={false}>
				<div className="flex items-center justify-between w-full">
					<div className="flex items-start gap-3 overflow-hidden min-w-0">
						<InformationCircleIcon className="h-7 w-7 text-gray-600 dark:text-gray-400 shrink-0" />
						<div className="flex flex-col min-w-0">
							<h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">Configuration</h3>
							<p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 -mt-0.5 font-mono truncate">
								v{config?.version || "N/A"}
							</p>
						</div>
					</div>
					<div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 ml-4">
						<Tooltip content="Close">
							<Button
								variant="ghost"
								size="md"
								iconOnly
								className="order-1 sm:order-3"
								onClick={modalProps.handleClose}>
								<XMarkIcon className="h-6 w-6" />
							</Button>
						</Tooltip>
					</div>
				</div>
			</Modal.Header>

			{/* Tab Content */}
			<Modal.Content>
				<div className="h-[60vh] overflow-y-auto rounded-md break-words">
					<JsonViewer
						data={config}
						emptyMessage="No configuration available"
					/>
				</div>
			</Modal.Content>
		</Modal>
	);
};

export default ConfigModal;
