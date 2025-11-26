import React from "react";
import TimeAgoReact from "timeago-react";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import { convertToLocalDate } from "@/utils/formatDate";
import { Tooltip } from "@/components";

interface TimeAgoProps {
	datetime: string | Date;
	locale?: string;
	live?: boolean;
	className?: string;
}

/**
 * TimeAgo component with timezone conversion support
 * Converts server timezone to browser timezone before displaying
 */
const TimeAgo: React.FC<TimeAgoProps> = ({ datetime, locale = "en_US", live = true, className }) => {
	const { config } = useGlobalStateContext();

	// Get server timezone from config, default to UTC
	const serverTimezone = config?.timezone || "UTC";

	// Convert date from server timezone to browser timezone
	const localDate = convertToLocalDate(datetime, serverTimezone);

	// Format tooltip date as YYYY/MM/DD HH:mm
	const formattedDate = `${localDate.getFullYear()}/${String(localDate.getMonth() + 1).padStart(2, "0")}/${String(localDate.getDate()).padStart(2, "0")} ${String(localDate.getHours()).padStart(2, "0")}:${String(localDate.getMinutes()).padStart(2, "0")}`;

	return (
		<Tooltip content={formattedDate}>
			<span>
				<TimeAgoReact
					datetime={localDate}
					locale={locale}
					live={live}
					className={className}
					opts={{ minInterval: 30 }}
				/>
			</span>
		</Tooltip>
	);
};

export default TimeAgo;
