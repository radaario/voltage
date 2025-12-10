import { config } from "@voltage/config";
import { database } from "./database";
import { getNow } from "./helpers/date";
import { uukey } from "./helpers/crypto";
import { pino as _pino, Logger as PinoLogger } from "pino";

database.config(config.database);

/**
 * Log level type
 */
export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

/**
 * Log metadata interface
 */
export interface LogMetadata {
	instance_key?: string | null;
	worker_key?: string | null;
	job_key?: string | null;
	output_key?: string | null;
	notification_key?: string | null;
	[key: string]: any;
}

export interface MetadataStore {
	[channelKey: string]: LogMetadata;
}

/**
 * Create Pino logger instance with environment-based configuration
 */
function createPinoLogger(): PinoLogger {
	const level = process.env.LOG_LEVEL || "info";
	const isProd = config.env === "prod" || config.env === "production";

	return _pino({
		level,
		transport: !isProd
			? {
					target: "pino-pretty",
					options: {
						colorize: true,
						translateTime: "HH:MM:ss Z",
						ignore: "pid,hostname"
					}
				}
			: undefined
	});
}

const pino = createPinoLogger();

/**
 * Logger class for console and database logging
 */
class Logger {
	private _metadata: MetadataStore = {};
	private pino: PinoLogger;

	constructor(channelKey: string = "DEFAULT", metadata: LogMetadata = {}) {
		this.pino = pino;
		this.setMetadata(channelKey, metadata);
	}

	/**
	 * Set persistent metadata for all future logs
	 * @param data Metadata to merge
	 */
	setMetadata(channelKey: string = "DEFAULT", data: LogMetadata): void {
		// if channel key is not provided or is empty, do not set metadata
		if (!channelKey || channelKey === "") {
			return;
		}

		// if data is not an object, do not set metadata
		if (!data || typeof data !== "object") {
			return;
		}

		this._metadata[channelKey] = JSON.parse(JSON.stringify(data)); // { ...this._metadata, ...args };
		// this._metadata[channelKey] = { ...data } // it's bad code cause shallow copy
	}

	/**
	 * Clear persistent metadata
	 */
	clearMetadata(channelKey: string = "DEFAULT"): void {
		delete this._metadata[channelKey];
	}

	/**
	 * Insert log into database (async)
	 * @param type Log type/level
	 * @param message Log message
	 * @param metadata Additional metadata
	 * @returns Promise with log entry
	 */
	async insert(channelKey: string = "DEFAULT", type: string, message: string, metadata: LogMetadata = {}): Promise<any> {
		const _metadata = { ...this._metadata[channelKey], ...metadata };

		const log = {
			key: uukey(),
			type,
			instance_key: _metadata.instance_key || null,
			worker_key: _metadata.worker_key || null,
			job_key: _metadata.job_key || null,
			output_key: _metadata.output_key || null,
			notification_key: _metadata.notification_key || null,
			message: this.sanitizeMessage(message, _metadata),
			metadata: _metadata ? JSON.stringify(_metadata) : null,
			created_at: getNow()
		};

		if (!config.logs.is_disabled) {
			try {
				await database.table("logs").insert(log);
			} catch (error: Error | any) {
				this.console(channelKey, "ERROR", "Could not insert log into database!", { ...error });
			}
		}

		this.console(channelKey, type, message, metadata);

		return log;
	}

	/**
	 * Log to console only (synchronous)
	 * @param type Log type/level
	 * @param message Log message
	 * @param metadata Additional metadata
	 */
	console(channelKey: string = "DEFAULT", type: string, message: string, metadata: LogMetadata = {}): void {
		metadata = { ...this._metadata[channelKey], ...metadata };

		const data = { message: this.sanitizeMessage(message, metadata), ...metadata };

		switch (type.toLowerCase()) {
			case "fatal":
				this.pino.fatal(data);
				break;
			case "error":
				this.pino.error(data);
				break;
			case "warn":
			case "warning":
				this.pino.warn(data);
				break;
			case "info":
				this.pino.info(data);
				break;
			case "debug":
				this.pino.debug(data);
				break;
			case "trace":
				this.pino.trace(data);
				break;
			default:
				this.pino.info(data);
				break;
		}
	}

	/**
	 * Convenience methods for different log levels
	 */
	fatal(channelKey: string = "DEFAULT", message: string, metadata?: LogMetadata): void {
		this.console(channelKey, "fatal", message, metadata);
	}

	error(channelKey: string = "DEFAULT", message: string, metadata?: LogMetadata): void {
		this.console(channelKey, "error", message, metadata);
	}

	warn(channelKey: string = "DEFAULT", message: string, metadata?: LogMetadata): void {
		this.console(channelKey, "warn", message, metadata);
	}

	info(channelKey: string = "DEFAULT", message: string, metadata?: LogMetadata): void {
		this.console(channelKey, "info", message, metadata);
	}

	debug(channelKey: string = "DEFAULT", message: string, metadata?: LogMetadata): void {
		this.console(channelKey, "debug", message, metadata);
	}

	trace(channelKey: string = "DEFAULT", message: string, metadata?: LogMetadata): void {
		this.console(channelKey, "trace", message, metadata);
	}

	/**
	 * Sanitize message by replacing :key placeholders with metadata values
	 * @param message Message with placeholders
	 * @param metadata Metadata for placeholder replacement
	 * @returns Sanitized message
	 * @private
	 */
	private sanitizeMessage(message: string, metadata: LogMetadata): string {
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
