import { config } from "@voltage/config";
import { getNow, uukey } from "./index";

import { database } from "./database";

import { pino as _pino } from "pino";

// database.config(config.database);

const pino = _pino({
	level: process.env.LOG_LEVEL ?? "info",
	transport: config.env !== "prod" ? { target: "pino-pretty" } : undefined
});

class Logger {
	private _metadata: any = {};

	setMetadata(args: any) {
		this._metadata = { ...this._metadata, ...args };
	}

	async insert(type: string, message: string, metadata: any = {}) {
		metadata = { ...this._metadata, ...metadata };

		const instance_key = metadata.instance_key || null;
		const worker_key = metadata.worker_key || null;
		const job_key = metadata.job_key || null;
		const output_key = metadata.output_key || null;
		const notification_key = metadata.notification_key || null;

		const log = {
			key: uukey(),
			type,
			instance_key,
			worker_key,
			job_key,
			output_key,
			notification_key,
			message: this.sanitizeMessage(message, metadata),
			metadata: metadata ? JSON.stringify(metadata) : null,
			created_at: getNow()
		};

		if (!config.logs.is_disabled) {
			try {
				await database.table("logs").insert(log);
			} catch (error: Error | any) {
				this.console("ERROR", "Could not insert log into database!", { error });
			}
		}

		this.console(type, message, metadata);

		return log;
	}

	console(type: string, message: string, metadata: any = {}) {
		metadata = { ...this._metadata, ...metadata };

		const data = { message: this.sanitizeMessage(message, metadata), ...metadata };

		switch (type.toLowerCase()) {
			case "info":
				pino.info(data);
				break;
			case "error":
				pino.error(data);
				break;
			case "warn":
			case "warning":
				pino.warn(data);
				break;
			case "debug":
				pino.debug(data);
				break;
			case "trace":
				pino.trace(data);
				break;
			case "fatal":
				pino.fatal(data);
				break;
			default:
				pino.info(data);
				break;
		}
	}

	sanitizeMessage(message: string, metadata: any) {
		if (!metadata) {
			return message;
		}

		let sanitized = message;

		// Replace all :key placeholders with their values from metadata
		Object.keys(metadata).forEach((key) => {
			const placeholder = `:${key}`;
			const value = metadata[key] !== null && metadata[key] !== undefined ? String(metadata[key]) : "";
			sanitized = sanitized.replace(new RegExp(placeholder, "g"), value);
		});

		return sanitized;
	}
}

export const logger = new Logger();
