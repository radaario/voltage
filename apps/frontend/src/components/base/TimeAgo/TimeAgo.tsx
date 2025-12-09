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
	format?: string;
}

/**
 * TimeAgo component with timezone conversion support
 * Converts server timezone to browser timezone before displaying
 */
const TimeAgo: React.FC<TimeAgoProps> = ({
	datetime,
	locale = "en_US",
	live = true,
	className,
	format = import.meta.env.VITE_DATETIME_FORMAT || "YYYY-MM-DD HH:mm:ss"
}) => {
	const { config } = useGlobalStateContext();

	// Get server timezone from config, default to UTC
	const serverTimezone = config?.timezone || "UTC";

	// Convert date from server timezone to browser timezone
	const localDate = convertToLocalDate(datetime, serverTimezone);

	// Format date based on provided format string or default to YYYY-MM-DD HH:mm
	const formatDate = (date: Date, formatStr?: string): string => {
		if (!formatStr) {
			return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
		}

		const tokens: Record<string, string> = {
			YYYY: String(date.getFullYear()),
			YY: String(date.getFullYear()).slice(-2),
			MM: String(date.getMonth() + 1).padStart(2, "0"),
			M: String(date.getMonth() + 1),
			DD: String(date.getDate()).padStart(2, "0"),
			D: String(date.getDate()),
			HH: String(date.getHours()).padStart(2, "0"),
			H: String(date.getHours()),
			mm: String(date.getMinutes()).padStart(2, "0"),
			m: String(date.getMinutes()),
			ss: String(date.getSeconds()).padStart(2, "0"),
			s: String(date.getSeconds())
		};

		return formatStr.replace(/YYYY|YY|MM|M|DD|D|HH|H|mm|m|ss|s/g, (match) => tokens[match] || match);
	};

	const formattedDate = formatDate(localDate, format);

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
