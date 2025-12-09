import { database } from "@voltage/utils";
import { getDate, subtractFrom, getNow } from "@voltage/utils";

export const getStats = async (since_at?: string, until_at?: string) => {
	let sinceDate = since_at || "";
	let untilDate = until_at || "";

	if (!untilDate) untilDate = getNow("YYYY-MM-DD");
	if (!sinceDate) sinceDate = subtractFrom(untilDate, 1, "month", "YYYY-MM-DD");

	sinceDate = getDate(sinceDate, "YYYY-MM-DD");
	untilDate = getDate(untilDate, "YYYY-MM-DD");

	const stats = await database.table("stats").where("date", ">=", sinceDate).where("date", "<=", untilDate).orderBy("date", "asc");

	return { stats, since_at: sinceDate, until_at: untilDate };
};

export const deleteStats = async (params: { all?: boolean; stat_key?: string; date?: string; since_at?: string; until_at?: string }) => {
	if (params.all) {
		await database.table("stats").delete();
		await logger.insert("WARNING", "All stats successfully deleted!");
		return { message: "All stats successfully deleted!" };
	}

	if (params.stat_key) {
		await database.table("stats").where("stat_key", params.stat_key).delete();
		await logger.insert("WARNING", "Stats successfully deleted!", { ...params });
		return { message: "Stats successfully deleted!" };
	}

	if (params.date) {
		await database.table("stats").where("date", getDate(params.date, "YYYY-MM-DD")).delete();
		await logger.insert("WARNING", "Some stats successfully deleted!", { ...params });
		return { message: "Some stats successfully deleted!" };
	}

	let query = database.table("stats");

	if (params.since_at) {
		const sinceDate = getDate(params.since_at, "YYYY-MM-DD");
		query = query.where("date", ">=", sinceDate);
	}

	if (params.until_at) {
		const untilDate = getDate(params.until_at, "YYYY-MM-DD");
		query = query.where("date", "<=", untilDate);
	}

	await query.delete();

	await logger.insert("WARNING", "Some stats successfully deleted!", { ...params });

	return {
		message: "Some stats successfully deleted!",
		since_at: params.since_at || null,
		until_at: params.until_at || null
	};
};
