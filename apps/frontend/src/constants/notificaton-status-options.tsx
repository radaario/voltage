import type { SelectOption } from "@/components";
import { ArrowPathIcon, ClockIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

export const notificationStatusOptions: SelectOption<string>[] = [
	{ value: "PENDING", label: "PENDING", icon: <ClockIcon className="h-4 w-4 text-yellow-500" /> },
	{ value: "SUCCESSFUL", label: "SUCCESSFUL", icon: <CheckIcon className="h-4 w-4 text-green-500" /> },
	{ value: "FAILED", label: "FAILED", icon: <XMarkIcon className="h-4 w-4 text-red-500" /> },
	{ value: "SKIPPED", label: "SKIPPED", icon: <XMarkIcon className="h-4 w-4 text-gray-400" /> },
	{ value: "RETRYING", label: "RETRYING", icon: <ArrowPathIcon className="h-4 w-4 text-gray-400" /> }
];
