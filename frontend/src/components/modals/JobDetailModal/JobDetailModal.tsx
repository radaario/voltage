import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { Job } from "@/interfaces/job";

interface JobDetailModalProps {
	isOpen: boolean;
	onClose: () => void;
	job: Job | null;
}

const JobDetailModal: React.FC<JobDetailModalProps> = ({ isOpen, onClose, job }) => {
	const [isAnimating, setIsAnimating] = useState(false);
	const [shouldRender, setShouldRender] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setShouldRender(true);
			document.body.style.overflow = "hidden";
			// Trigger animation after render
			setTimeout(() => setIsAnimating(true), 10);
		} else {
			setIsAnimating(false);
			document.body.style.overflow = "unset";
			// Wait for animation to finish before unmounting
			const timer = setTimeout(() => setShouldRender(false), 300);
			return () => clearTimeout(timer);
		}

		return () => {
			document.body.style.overflow = "unset";
		};
	}, [isOpen]);

	const handleClose = () => {
		setIsAnimating(false);
		setTimeout(() => {
			onClose();
		}, 300);
	};

	if (!shouldRender || !job) return null;

	return (
		<div className="fixed inset-0 z-50 overflow-y-auto">
			{/* Backdrop */}
			<div
				className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
					isAnimating ? "opacity-100" : "opacity-0"
				}`}
				onClick={handleClose}
			/>

			{/* Modal Container */}
			<div className="flex min-h-full items-end sm:items-center justify-center p-4">
				{/* Modal Panel */}
				<div
					className={`relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 z-10 transition-all duration-300 ${
						isAnimating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
					}`}>
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-2xl font-bold text-gray-900 dark:text-white">Job Details</h3>
						<button
							type="button"
							onClick={handleClose}
							className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
							<XMarkIcon className="h-6 w-6" />
						</button>
					</div>

					{/* Modal içeriği buraya gelecek */}
					<div className="mt-4">
						<div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
							<p className="text-sm text-gray-600 dark:text-gray-400 font-mono">Job Key: {job.key}</p>
							<p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
								Status: <span className="font-semibold">{job.status}</span>
							</p>
						</div>
					</div>

					<div className="mt-6 flex justify-end gap-3">
						<button
							type="button"
							onClick={handleClose}
							className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
							Close
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default JobDetailModal;
