import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { JobPreviewImage } from "@/components";

interface JobCardProps {
	jobKey: string;
	title?: string;
	onClick?: () => void;
}

const JobCard = ({ jobKey, title, onClick }: JobCardProps) => {
	const navigate = useNavigate();
	const { authToken } = useAuth();

	// Use title prop first, then file_name, then fallback to "Job #X" or "Job"
	const displayTitle = title;

	// actions
	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onClick) {
			onClick();
		} else {
			navigate(`/jobs/${jobKey}/info`);
		}
	};

	return (
		<button
			onClick={handleClick}
			className="flex items-center gap-2 p-2 rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600 transition-colors text-left group">
			{/* Preview Image */}
			<JobPreviewImage
				jobKey={jobKey}
				authToken={authToken}
				version={null}
				className="w-4 h-4 relative shrink-0 bg-gray-100 dark:bg-neutral-700 rounded overflow-hidden"
			/>
			{/* Content */}
			<div className="flex-1 min-w-0">
				{displayTitle && (
					<div className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
						{displayTitle}
					</div>
				)}
				<div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{jobKey}</div>
			</div>
		</button>
	);
};

export default JobCard;
