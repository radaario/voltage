import { InformationCircleIcon, ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { SelectOption } from "@/components";

export const logTypeOptions: SelectOption<string>[] = [
	{ value: "INFO", label: "INFO", icon: <InformationCircleIcon className="h-4 w-4 text-blue-500" /> },
	{ value: "WARNING", label: "WARNING", icon: <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" /> },
	{ value: "ERROR", label: "ERROR", icon: <XMarkIcon className="h-4 w-4 text-red-500" /> }
];
