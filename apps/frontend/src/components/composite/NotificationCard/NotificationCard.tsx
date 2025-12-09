import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiResponse } from "@/utils";
import type { Notification } from "@/interfaces/notification";
import { Label } from "@/components";

interface NotificationCardProps {
	notificationKey: string;
	onClick?: () => void;
}

const NotificationCard = ({ notificationKey, onClick }: NotificationCardProps) => {
	const navigate = useNavigate();
	const { authToken } = useAuth();

	// Fetch notification details
	const { data: notificationResponse } = useQuery<ApiResponse<Notification[]>>({
		queryKey: ["notification", notificationKey],
		queryFn: () =>
			api.get<Notification[]>("/jobs/notifications", {
				token: authToken || "",
				notification_key: notificationKey || ""
			}),
		enabled: !!notificationKey && !!authToken
	});

	const notification = notificationResponse?.data?.[0];

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onClick) {
			onClick();
		} else {
			navigate(`/notifications/${notificationKey}/info`);
		}
	};

	return (
		<button
			onClick={handleClick}
			className="flex items-center gap-2 p-2 rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600 transition-colors text-left group min-w-0">
			{/* Content */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					{notification?.payload?.status && (
						<span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
							{notification?.payload?.status}
						</span>
					)}
					{notification?.status && <Label status={notification.status}>{notification.status}</Label>}
				</div>
				<div className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">{notificationKey.slice(0, 8)}...</div>
			</div>
		</button>
	);
};

export default NotificationCard;
