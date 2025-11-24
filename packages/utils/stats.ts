import { config } from "@voltage/config";
import { getNow, getDate, hash } from "./index";

import { database } from "./database";

// database.config(config.database);

class Stats {
	async update(data: any = {}, date: string | null = null) {
		if (!data) return null;

		if (date) date = getDate(date, "YYYY-MM-DD");
		if (!date) date = getNow("YYYY-MM-DD");

		const dateKey = hash(date);

		const existing = await database.table("stats").where({ date }).first();

		if (existing) {
			existing.data = existing.data ? JSON.parse(existing.data) : {};

			for (const key in data) {
				if (existing.data[key] !== undefined) {
					existing.data[key] += data[key];
				} else {
					existing.data[key] = data[key];
				}
			}

			return await database
				.table("stats")
				.where("key", dateKey)
				.update({ data: existing.data ? JSON.stringify(existing.data) : null });
		} else {
			return await database.table("stats").insert({
				key: dateKey,
				date,
				data: data ? JSON.stringify(data) : null
			});
		}
	}
}

export const stats = new Stats();
