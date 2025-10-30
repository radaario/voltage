export function timeAgo(date: string): string {
	// Get the current date
	const currentDate: Date = new Date();

	// Get the date to compare with (parameter date)
	const compareDate: Date = new Date(date);

	// Get the time difference between two dates (in milliseconds)
	const difference: number = currentDate.getTime() - compareDate.getTime();

	// Convert milliseconds to seconds
	const secondsDifference: number = Math.floor(difference / 1000);

	if (secondsDifference <= 0) {
		return `right now`;
	} else if (secondsDifference < 60) {
		return `${secondsDifference} seconds ago`;
	} else if (secondsDifference < 3600) {
		// Convert seconds to minutes
		const minutesDifference: number = Math.floor(secondsDifference / 60);
		return `${minutesDifference} minutes ago`;
	} else if (secondsDifference < 86400) {
		// Convert seconds to hours
		const hoursDifference: number = Math.floor(secondsDifference / 3600);
		return `${hoursDifference} hours ago`;
	} else {
		// Convert seconds to days
		const daysDifference: number = Math.floor(secondsDifference / 86400);
		return `${daysDifference} days ago`;
	}
}
