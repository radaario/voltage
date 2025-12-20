import {
	ClockIcon,
	ArrowPathIcon,
	ArrowDownTrayIcon,
	ArrowUpTrayIcon,
	ArrowDownOnSquareIcon,
	ChartBarIcon,
	CheckIcon,
	XMarkIcon
} from "@heroicons/react/24/outline";
import type { SelectOption } from "@/components";

export const jobStatusOptions: SelectOption<string>[] = [
	{ value: "RECEIVED", label: "RECEIVED", icon: <ArrowDownOnSquareIcon className="h-4 w-4 text-gray-400" /> },
	{ value: "PENDING", label: "PENDING", icon: <ClockIcon className="h-4 w-4 text-yellow-500" /> },
	{ value: "RETRYING", label: "RETRYING", icon: <ArrowPathIcon className="h-4 w-4 text-yellow-500" /> },
	{ value: "QUEUED", label: "QUEUED", icon: <ClockIcon className="h-4 w-4 text-yellow-500" /> },
	{ value: "STARTED", label: "STARTED", icon: <ArrowPathIcon className="h-4 w-4 text-blue-500" /> },
	{ value: "DOWNLOADING", label: "DOWNLOADING", icon: <ArrowDownTrayIcon className="h-4 w-4 text-blue-500" /> },
	{ value: "DOWNLOADED", label: "DOWNLOADED", icon: <ArrowDownTrayIcon className="h-4 w-4 text-blue-500" /> },
	{ value: "ANALYZING", label: "ANALYZING", icon: <ChartBarIcon className="h-4 w-4 text-blue-500" /> },
	{ value: "ANALYZED", label: "ANALYZED", icon: <ChartBarIcon className="h-4 w-4 text-blue-500" /> },
	{ value: "PROCESSING", label: "PROCESSING", icon: <ChartBarIcon className="h-4 w-4 text-blue-500" /> },
	{ value: "PROCESSED", label: "PROCESSED", icon: <CheckIcon className="h-4 w-4 text-blue-500" /> },
	{ value: "UPLOADING", label: "UPLOADING", icon: <ArrowUpTrayIcon className="h-4 w-4 text-blue-500" /> },
	{ value: "UPLOADED", label: "UPLOADED", icon: <ArrowUpTrayIcon className="h-4 w-4 text-blue-500" /> },
	{ value: "COMPLETED", label: "COMPLETED", icon: <CheckIcon className="h-4 w-4 text-green-500" /> },
	{ value: "CANCELLED", label: "CANCELLED", icon: <XMarkIcon className="h-4 w-4 text-gray-500" /> },
	{ value: "DELETED", label: "DELETED", icon: <XMarkIcon className="h-4 w-4 text-gray-400" /> },
	{ value: "FAILED", label: "FAILED", icon: <XMarkIcon className="h-4 w-4 text-red-500" /> },
	{ value: "TIMEOUT", label: "TIMEOUT", icon: <XMarkIcon className="h-4 w-4 text-yellow-500" /> }
];
