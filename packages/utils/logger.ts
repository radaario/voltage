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
	private _metadata: LogMetadata = {};
	private pino: PinoLogger;

	constructor() {
		this.pino = pino;
	}

	/**
	 * Set persistent metadata for all future logs
	 * @param args Metadata to merge
	 */
	setMetadata(args: LogMetadata): void {
		this._metadata = args; // { ...this._metadata, ...args };
	}

	/**
	 * Clear persistent metadata
	 */
	clearMetadata(): void {
		this._metadata = {};
	}

	/**
	 * Insert log into database (async)
	 * @param type Log type/level
	 * @param message Log message
	 * @param metadata Additional metadata
	 * @returns Promise with log entry
	 */
	async insert(type: string, message: string, metadata: LogMetadata = {}): Promise<any> {
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
			} catch (error) {
				this.console("ERROR", "Could not insert log into database!", { error });
			}
		}

		this.console(type, message, metadata);

		return log;
	}

	/**
	 * Log to console only (synchronous)
	 * @param type Log type/level
	 * @param message Log message
	 * @param metadata Additional metadata
	 */
	console(type: string, message: string, metadata: LogMetadata = {}): void {
		metadata = { ...this._metadata, ...metadata };

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
	fatal(message: string, metadata?: LogMetadata): void {
		this.console("fatal", message, metadata);
	}

	error(message: string, metadata?: LogMetadata): void {
		this.console("error", message, metadata);
	}

	warn(message: string, metadata?: LogMetadata): void {
		this.console("warn", message, metadata);
	}

	info(message: string, metadata?: LogMetadata): void {
		this.console("info", message, metadata);
	}

	debug(message: string, metadata?: LogMetadata): void {
		this.console("debug", message, metadata);
	}

	trace(message: string, metadata?: LogMetadata): void {
		this.console("trace", message, metadata);
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
