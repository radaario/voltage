export function formatDate(date: string | Date): string {
	const d = new Date(date);

	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

	const month = months[d.getMonth()];
	const day = d.getDate().toString().padStart(2, "0");
	const year = d.getFullYear();
	const hours = d.getHours().toString().padStart(2, "0");
	const minutes = d.getMinutes().toString().padStart(2, "0");
	const seconds = d.getSeconds().toString().padStart(2, "0");

	return `${month} ${day}, ${year} ${hours}:${minutes}:${seconds}`;
}
