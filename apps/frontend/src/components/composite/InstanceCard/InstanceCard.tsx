import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import type { Instance } from "@/interfaces/instance";
import { getInstanceName } from "@/utils/naming";
import { ServerIcon } from "@heroicons/react/24/outline";

interface InstanceCardProps {
	instanceKey: string;
	onClick?: () => void;
}

const InstanceCard = ({ instanceKey, onClick }: InstanceCardProps) => {
	const navigate = useNavigate();
	const { authToken } = useAuth();

	// Fetch all instances to get the name
	const { data: instancesResponse } = useQuery<ApiResponse<Instance[]>>({
		queryKey: ["instances", authToken],
		queryFn: () => api.get<Instance[]>("/instances", { token: authToken }),
		enabled: !!authToken
	});

	const instance = instancesResponse?.data?.find((inst) => inst.key === instanceKey);
	const instanceName = instance && instancesResponse?.data ? getInstanceName(instancesResponse.data, instance) : null;
	const displayText = instanceName || "Instance";

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onClick) {
			onClick();
		} else {
			navigate(`/instances/${instanceKey}/info`);
		}
	};

	return (
		<button
			onClick={handleClick}
			className="flex items-center gap-2 p-2 rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600 transition-colors text-left group min-w-0">
			{/* Content */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<ServerIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0" />
					<span className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
						{displayText}
					</span>
					{instance?.type && (
						<span
							className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
								instance.type === "MASTER"
									? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800"
									: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
							}`}>
							{instance.type}
						</span>
					)}
				</div>
			</div>
		</button>
	);
};

export default InstanceCard;
