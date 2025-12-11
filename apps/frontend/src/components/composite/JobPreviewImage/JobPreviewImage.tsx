import { api, formatDuration } from "@/utils";

interface JobPreviewImageProps {
	jobKey: string;
	version: string | null | undefined;
	className?: string;
	duration?: number;
}

const JobPreviewImage = ({ jobKey, duration, version, className }: JobPreviewImageProps) => {
	const imageUrl = api.getResourceUrl("/jobs/preview", { job_key: jobKey, ...(version && { v: version }) });

	return (
		<div
			className={
				className ||
				"w-20 h-14 relative shrink-0 bg-gray-100 dark:bg-neutral-800 group-hover:bg-gray-200 dark:group-hover:bg-neutral-700 rounded overflow-hidden transition-colors border border-gray-100 dark:border-neutral-700"
			}>
			<img
				key={imageUrl}
				src={imageUrl}
				alt="Preview"
				className="w-full h-full object-cover"
				loading="lazy"
				onError={(e) => {
					const target = e.target as HTMLImageElement;
					target.style.display = "none";
				}}
			/>
			{duration && duration > 0 && (
				<div className="absolute bottom-1 right-1 px-1.5 py-1 bg-black/80 rounded text-white text-[9px] font-semibold leading-none">
					{formatDuration(duration)}
				</div>
			)}
		</div>
	);
};

export default JobPreviewImage;
