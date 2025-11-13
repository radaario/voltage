import { isNil, isString } from "lodash";
import moment from "moment";
// import "moment-timezone";
import "moment/min/locales";

// moment.tz.setDefault("UTC");
moment.defaultFormat = "YYYY-MM-DD HH:mm:ss";

const MOMENT_REFERENCE = moment(); // fixed just for testing, use moment();
const TODAY = MOMENT_REFERENCE.clone().startOf("day");
const YESTERDAY = MOMENT_REFERENCE.clone().subtract(1, "days").startOf("day");
const A_WEEK_OLD = MOMENT_REFERENCE.clone().subtract(7, "days").startOf("day");

export const toMomentDate = (date = undefined, format?: any, timezone?: any) => {
	let momentDate: any = moment(isNil(date) || date === "NOW" ? undefined : date);

	timezone = timezone !== false && (timezone ? timezone : null) /*moment.tz.guess()*/; // guess: Europe/Istanbul

	if (timezone) {
		momentDate = momentDate.tz(timezone);
	}

	if (format) {
		momentDate = momentDate.format(format === true ? "YYYY-MM-DD HH:mm" : format);
	}

	return momentDate;
};

export const isToday = (date: any) => {
	return toMomentDate(date).utc().isSame(TODAY, "d");
};

export const isFirstDay = (date: any) => {
	return isToday(date);
};

export const isYesterday = (date: any) => {
	return toMomentDate(date).utc().isSame(YESTERDAY, "d");
};

export const isWithinAWeek = (date: any) => {
	return toMomentDate(date).utc().isAfter(A_WEEK_OLD);
};

export const isTwoWeeksOrMore = (date: any) => {
	return !isWithinAWeek(toMomentDate(date));
};

export const toHourFormat = (val: any) => {
	const formatted = parseFloat(val).toFixed(2).replace(".", ":");
	return `${formatted.length === 4 ? "0" : ""}${formatted}`;
};

export const toDuration = (val: any) => {
	if (isString(val)) {
		const time = val.replace(".", ":").trim();
		return time.startsWith("0:") ? `0${time}` : time;
	}

	const number = +val;

	if (number === 0 || isNaN(number) || number < 0) {
		return "00:00";
	}

	var hours = Math.floor(number / 60);
	var minutes = number % 60;

	var hoursText = hours < 10 ? "0" + hours : hours;
	var minutesText = minutes < 10 ? "0" + minutes : minutes;

	return hoursText + ":" + minutesText;
};
