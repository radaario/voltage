import { appConfig } from "@voltage/config";
import { Request, Response, NextFunction } from "express";
import Joi, { ObjectSchema } from "joi";

type ValidateTarget = "body" | "query" | "params";
type ValidateTargets = ValidateTarget | ValidateTarget[];

export const validateMiddleware =
	<T>(schema: ObjectSchema<T>, targets: ValidateTargets = "body") =>
	(req: Request, res: Response, next: NextFunction) => {
		const targetList = Array.isArray(targets) ? targets : [targets];

		let data = {} as Record<string, unknown>;

		for (const target of targetList) {
			data = {
				...data,
				...req[target]
			};
		}

		const { error, value } = schema.validate(data, {
			abortEarly: false,
			stripUnknown: true
		});

		if (error) {
			return res.status(400).json({
				metadata: {
					version: appConfig.version,
					env: appConfig.env,
					status: "ERROR",
					error: {
						code: "VALIDATION_ERROR",
						message: `${error.details.map((d) => d.message).join(", ")}!`
					}
				}
			});
		}

		// Redistribute the validated result
		for (const target of targetList) {
			req[target] = value as any;
		}

		next();
	};
