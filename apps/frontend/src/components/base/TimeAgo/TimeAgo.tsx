import React from "react";
import TimeAgoReact from "timeago-react";
import { useGlobalStateContext } from "@/contexts/GlobalStateContext";
import { convertToLocalDate } from "@/utils/formatDate";

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

	return (
		<TimeAgoReact
			datetime={localDate}
			locale={locale}
			live={live}
			className={className}
			opts={{ minInterval: 30 }}
		/>
	);
};

export default TimeAgo;
