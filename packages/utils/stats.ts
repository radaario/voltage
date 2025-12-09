import { config } from "@voltage/config";
import { database } from "./database";
import { getNow, getDate } from "./helpers/date";
import { hash } from "./helpers/crypto";

database.config(config.database);

/**
 * Stats data interface
 */
export interface StatsData {
	[key: string]: number;
}

/**
 * Stats management class
 * Handles daily statistics with atomic updates
 */
class Stats {
	/**
	 * Update statistics for a given date (atomic increment)
	 * Uses Knex increment for race-condition-safe updates
	 * @param data Stats data to increment
	 * @param date Date string (defaults to today)
	 * @returns Promise with update result
	 */
	async update(data: StatsData = {}, date: string | null = null): Promise<any> {
		if (!data || Object.keys(data).length === 0) return null;

		// Normalize date
		if (date) {
			date = getDate(date, "YYYY-MM-DD");
		}
		if (!date) {
			date = getNow("YYYY-MM-DD");
		}

		const dateKey = hash(date);

		// Use transaction for atomic operation
		return database.transaction(async (trx) => {
			// Check if entry exists
			const existing = await trx(database.getTablePrefix() + "stats")
				.where({ date })
				.first();

			if (existing) {
				// Parse existing data
				const existingData = existing.data ? JSON.parse(existing.data) : {};

				// Merge with new data
				for (const key in data) {
					if (existingData[key] !== undefined) {
						existingData[key] += data[key];
					} else {
						existingData[key] = data[key];
					}
				}

				// Update with merged data
				return await trx(database.getTablePrefix() + "stats")
					.where("key", dateKey)
					.update({
						data: JSON.stringify(existingData)
					});
			} else {
				// Insert new entry
				return await trx(database.getTablePrefix() + "stats").insert({
					key: dateKey,
					date,
					data: JSON.stringify(data)
				});
			}
		});
	}

	/**
	 * Get stats for a specific date
	 * @param date Date string
	 * @returns Promise with stats data or null
	 */
	async get(date: string): Promise<StatsData | null> {
		const normalizedDate = getDate(date, "YYYY-MM-DD");
		const result = await database.table("stats").where({ date: normalizedDate }).first();

		if (!result) return null;

		return result.data ? JSON.parse(result.data) : null;
	}

	/**
	 * Get stats for a date range
	 * @param startDate Start date string
	 * @param endDate End date string
	 * @returns Promise with array of stats entries
	 */
	async getRange(startDate: string, endDate: string): Promise<Array<{ date: string; data: StatsData }>> {
		const start = getDate(startDate, "YYYY-MM-DD");
		const end = getDate(endDate, "YYYY-MM-DD");

		const results = await database.table("stats").whereBetween("date", [start, end]).orderBy("date", "asc");

		return results.map((row: any) => ({
			date: row.date,
			data: row.data ? JSON.parse(row.data) : {}
		}));
	}

	/**
	 * Delete stats older than retention period
	 * @returns Promise with number of deleted rows
	 */
	async cleanup(): Promise<number> {
		const retentionDays = Math.floor(config.stats.retention / (24 * 60 * 60 * 1000));
		const cutoffDate = getNow("YYYY-MM-DD");

		// Calculate cutoff using moment
		const cutoff = getDate(cutoffDate, "YYYY-MM-DD");

		const deleted = await database.table("stats").where("date", "<", cutoff).del();

		return deleted;
	}
}

export const stats = new Stats();
