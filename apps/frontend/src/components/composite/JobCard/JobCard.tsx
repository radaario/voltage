import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse, formatDuration } from "@/utils";
import type { Job } from "@/interfaces/job";
import { JobPreviewImage } from "@/components/composite/JobPreviewImage";

interface JobCardProps {
	jobKey: string;
	title?: string;
	onClick?: () => void;
}

const JobCard = ({ jobKey, title, onClick }: JobCardProps) => {
	const navigate = useNavigate();
	const { authToken } = useAuth();

	// Fetch job to get file name
	const { data: jobResponse } = useQuery<ApiResponse<Job>>({
		queryKey: ["job", jobKey, authToken],
		queryFn: () => api.get<Job>("/jobs", { job_key: jobKey, token: authToken }),
		enabled: !!jobKey && !!authToken
	});

	const job = jobResponse?.data;

	// Fetch all jobs for count context
	const { data: allJobsResponse } = useQuery<ApiResponse<Job[]>>({
		queryKey: ["jobs", authToken],
		queryFn: () => api.get<Job[]>("/jobs", { token: authToken }),
		enabled: !!authToken && !job?.input?.file_name
	});

	// Find job index (1-based)
	const jobIndex = allJobsResponse?.data?.findIndex((j: Job) => j.key === jobKey);
	const jobNumber = jobIndex !== undefined && jobIndex !== -1 ? jobIndex + 1 : null;

	// Use title prop first, then file_name, then fallback to "Job #X" or "Job"
	const displayTitle = title || job?.input?.file_name || (jobNumber ? `Job ${jobNumber}` : "Job");

	const specs: string[] = [];

	// Duration
	const duration = job?.input?.duration;
	if (duration) {
		specs.push(formatDuration(duration));
	}

	// Resolution
	const width = job?.input?.video_width;
	const height = job?.input?.video_height;
	if (width && height) {
		specs.push(`${width}x${height}px`);
	}

	// Size
	const size = job?.input?.file_size;
	if (size) {
		const sizeInMB = (size / (1024 * 1024)).toFixed(1);
		specs.push(`${sizeInMB}mb`);
	}

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
				version={job?.updated_at ?? null}
				className="w-12 h-9 relative shrink-0 bg-gray-100 dark:bg-neutral-700 rounded overflow-hidden"
			/>
			{/* Content */}
			<div className="flex-1 min-w-0">
				<div className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
					{displayTitle}
				</div>
				<div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{jobKey}</div>
				{specs.length > 0 && <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{specs.join(", ")}</div>}
			</div>
		</button>
	);
};

export default JobCard;
