import { Request, Response } from "express";
import { sanitizeData } from "@voltage/utils";
import { sendSuccess, sendError } from "@/utils/response.util.js";
import * as authService from "@/services/auth.service.js";

export const authenticate = async (req: Request, res: Response) => {
	try {
		const inputPassword = (req.query.password || req.body.password || "").trim();
		const token = authService.authenticateFrontend(inputPassword);

		if (token) {
			return sendSuccess(res, { token });
		}

		return sendSuccess(res);
	} catch (error: any) {
		if (error.message === "PASSWORD_REQUIRED") {
			return sendError(res, 400, "PASSWORD_REQUIRED", "Password required!");
		}

		if (error.message === "PASSWORD_INVALID") {
			return sendError(res, 401, "PASSWORD_INVALID", "Invalid password!");
		}

		throw error;
	}
};
