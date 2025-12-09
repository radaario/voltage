import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { JobPreviewImage, Tooltip } from "@/components";
import { useQuery } from "@tanstack/react-query";
import { api, ApiResponse } from "@/utils";
import { Job } from "@/interfaces";

interface JobCardProps {
	jobKey: string;
	title?: string;
	onClick?: () => void;
	className?: string;
}

const JobCard = ({ jobKey, title, onClick, className }: JobCardProps) => {
	const navigate = useNavigate();
	const { authToken } = useAuth();

	// queries
	const { data: jobResponse } = useQuery<ApiResponse<Job>>({
		queryKey: ["job", jobKey],
		queryFn: () =>
			api.get<Job>("/jobs", {
				token: authToken || "",
				job_key: jobKey || ""
			}),
		enabled: !!jobKey && !!authToken
	});

	// Use title prop first, then file_name, then fallback to "Job #X" or "Job"
	const displayTitle = title;
	const job = jobResponse?.data;
	const filename = job?.input?.file_name || job?.input?.url?.split("/").pop() || "";

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
		<Tooltip content={filename}>
			<button
				onClick={handleClick}
				className={`flex items-center gap-2 p-2 rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600 transition-colors text-left group ${className}`}>
				{/* Preview Image */}
				<JobPreviewImage
					jobKey={jobKey}
					version={job?.analyzed_at}
					className="w-4 h-4 relative shrink-0 bg-gray-100 dark:bg-neutral-700 rounded overflow-hidden"
				/>
				{/* Content */}
				<div className="flex-1 min-w-0">
					{displayTitle && (
						<div className="text-sm font-medium text-gray-900 dark:text-white sm:truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
							{displayTitle}
						</div>
					)}
					<div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{jobKey}</div>
				</div>
			</button>
		</Tooltip>
	);
};

export default JobCard;
