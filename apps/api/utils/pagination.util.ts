import { Request } from "express";
import { PaginationParams } from "@/types/index.js";

export const getPaginationParams = (req: Request, defaultLimit: number = 25): PaginationParams => {
	const rawLimit = req.query.limit;
	const rawPage = req.query.page;

	let limit = rawLimit !== undefined ? parseInt(String(rawLimit), 10) : defaultLimit;
	if (isNaN(limit) || limit < 1) limit = defaultLimit;

	let page = rawPage !== undefined ? parseInt(String(rawPage), 10) : 1;
	if (isNaN(page) || page < 1) page = 1;

	const offset = (page - 1) * limit;

	return { limit, page, offset };
};
