import { config } from "@voltage/config";
import { Response } from "express";
import { ApiResponse } from "@/types/index.js";

export const responseMetadata = {
	version: config.version,
	env: config.env
};

export const sendSuccess = <T = any>(res: Response, data?: T, additionalMetadata?: Record<string, any>, message?: string): Response => {
	const response: ApiResponse<T> = {
		metadata: {
			...responseMetadata,
			...additionalMetadata,
			status: "SUCCESSFUL"
		}
	};

	if (data !== undefined) response.data = data;
	if (message) response.message = message;

	return res.json(response);
};

export const sendError = (
	res: Response,
	statusCode: number,
	errorCode: string,
	errorMessage: string,
	additionalMetadata?: Record<string, any>
): Response => {
	return res.status(statusCode).json({
		metadata: {
			...responseMetadata,
			...additionalMetadata,
			status: "ERROR",
			error: {
				code: errorCode,
				message: errorMessage
			}
		}
	});
};

export const sendPaginatedSuccess = <T = any>(
	res: Response,
	data: T[],
	pagination: {
		limit: number;
		page: number;
		total: number;
	},
	additionalMetadata?: Record<string, any>
): Response => {
	const totalPages = Math.ceil(pagination.total / pagination.limit);
	const hasMore = pagination.page < totalPages;
	const nextPage = hasMore ? pagination.page + 1 : null;
	const prevPage = pagination.page > 1 ? pagination.page - 1 : null;

	return res.json({
		metadata: {
			...responseMetadata,
			...additionalMetadata,
			status: "SUCCESSFUL"
		},
		data,
		pagination: {
			...pagination,
			total_pages: totalPages,
			has_more: hasMore,
			next_page: nextPage,
			prev_page: prevPage
		}
	});
};
