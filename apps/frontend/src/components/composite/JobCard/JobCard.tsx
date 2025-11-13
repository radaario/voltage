import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import type { Job } from "@/interfaces/job";

interface JobCardProps {
	jobKey: string;
	title?: string;
	onClick?: () => void;
}

const JobCard = ({ jobKey, title, onClick }: JobCardProps) => {
	const navigate = useNavigate();
	const { authToken } = useAuth();

	// Fetch job to get file name
	const { data: jobResponse } = useQuery<{ data: Job; metadata?: any }>({
		queryKey: ["job", jobKey, authToken],
		queryFn: async () => {
			const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/jobs?job_key=${jobKey}&token=${authToken}`);
			if (!res.ok) throw new Error("Failed to fetch job");
			return res.json();
		},
		enabled: !!jobKey && !!authToken
	});

	const job = jobResponse?.data;

	// Fetch all jobs to get index
	const { data: allJobsResponse } = useQuery<{ data: Job[]; metadata?: any }>({
		queryKey: ["jobs", authToken],
		queryFn: async () => {
			const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/jobs?token=${authToken}`);
			if (!res.ok) throw new Error("Failed to fetch jobs");
			return res.json();
		},
		enabled: !!authToken && !job?.input?.file_name
	});

	// Find job index (1-based)
	const jobIndex = allJobsResponse?.data?.findIndex((j) => j.key === jobKey);
	const jobNumber = jobIndex !== undefined && jobIndex !== -1 ? jobIndex + 1 : null;

	// Use title prop first, then file_name, then fallback to "Job #X" or "Job"
	const displayTitle = title || job?.input?.file_name || (jobNumber ? `Job ${jobNumber}` : "Job");

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onClick) {
			onClick();
		} else {
			navigate(`/jobs/${jobKey}`);
		}
	};

	return (
		<button
			onClick={handleClick}
			className="flex items-center gap-2 p-2 rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600 transition-colors text-left group">
			{/* Preview Image */}
			<div className="w-12 h-9 relative shrink-0 bg-gray-100 dark:bg-neutral-700 rounded overflow-hidden">
				<img
					src={`${import.meta.env.VITE_API_BASE_URL}/jobs/preview?job_key=${jobKey}&token=${authToken}`}
					alt="Preview"
					className="w-full h-full object-cover"
					onError={(e) => {
						const target = e.target as HTMLImageElement;
						target.style.display = "none";
					}}
				/>
			</div>

			{/* Content */}
			<div className="flex-1 min-w-0">
				<div className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
					{displayTitle}
				</div>
			</div>
		</button>
	);
};

export default JobCard;
