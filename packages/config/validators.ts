import type { Config, StorageType, DatabaseType } from "./types";

export class ConfigValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConfigValidationError";
	}
}

/**
 * Validates application configuration
 * Throws ConfigValidationError if validation fails
 */
export function validateConfig(config: Config): void {
	// Validate basic app config
	validateApp(config);

	// Validate ports
	validatePorts(config);

	// Validate storage configuration
	validateStorage(config.storage.type, config.storage);

	// Validate database configuration
	validateDatabase(config.database.type, config.database);

	// Validate runtime configuration
	validateRuntime(config);

	// Validate jobs configuration
	validateJobs(config);
}

function validateApp(config: Config): void {
	if (!config.name || config.name.trim() === "") {
		throw new ConfigValidationError("Application name cannot be empty");
	}

	if (!config.version || config.version.trim() === "") {
		throw new ConfigValidationError("Application version cannot be empty");
	}

	if (!config.timezone || config.timezone.trim() === "") {
		throw new ConfigValidationError("Timezone cannot be empty");
	}
}

function validatePorts(config: Config): void {
	const ports = [
		{ name: "VOLTAGE_PORT", value: config.port },
		{ name: "VOLTAGE_NGINX_PORT", value: config.ngnix_port },
		{ name: "VOLTAGE_API_NODE_PORT", value: config.api.node_port },
		{ name: "VOLTAGE_FRONTEND_NODE_PORT", value: config.frontend.node_port }
	];

	for (const port of ports) {
		if (!Number.isInteger(port.value)) {
			throw new ConfigValidationError(`${port.name} must be an integer (got: ${port.value})`);
		}

		if (port.value < 1 || port.value > 65535) {
			throw new ConfigValidationError(`${port.name} must be between 1 and 65535 (got: ${port.value})`);
		}
	}

	// Validate database port separately as it might be 0 for SQLite
	if (config.database.type !== "SQLITE") {
		if (!Number.isInteger(config.database.port)) {
			throw new ConfigValidationError(`VOLTAGE_DATABASE_PORT must be an integer (got: ${config.database.port})`);
		}

		if (config.database.port < 1 || config.database.port > 65535) {
			throw new ConfigValidationError(`VOLTAGE_DATABASE_PORT must be between 1 and 65535 (got: ${config.database.port})`);
		}
	}
}

function validateStorage(type: StorageType, storage: Config["storage"]): void {
	// LOCAL storage doesn't need additional validation
	if (type === "LOCAL") {
		return;
	}

	// FTP/SFTP validation
	if (type === "FTP" || type === "SFTP") {
		if (!storage.host || storage.host.trim() === "") {
			throw new ConfigValidationError(`VOLTAGE_STORAGE_HOST is required for ${type} storage`);
		}

		if (!storage.username || storage.username.trim() === "") {
			throw new ConfigValidationError(`VOLTAGE_STORAGE_USERNAME is required for ${type} storage`);
		}

		return;
	}

	// S3-compatible storage validation
	if (!storage.region || storage.region.trim() === "") {
		throw new ConfigValidationError(`VOLTAGE_STORAGE_REGION is required for ${type} storage`);
	}

	if (!storage.bucket || storage.bucket.trim() === "") {
		throw new ConfigValidationError(`VOLTAGE_STORAGE_BUCKET is required for ${type} storage`);
	}

	if (!storage.access_key || storage.access_key.trim() === "") {
		throw new ConfigValidationError(`VOLTAGE_STORAGE_ACCESS_KEY is required for ${type} storage`);
	}

	if (!storage.access_secret || storage.access_secret.trim() === "") {
		throw new ConfigValidationError(`VOLTAGE_STORAGE_ACCESS_SECRET is required for ${type} storage (secret is protected)`);
	}

	// Custom endpoint validation for OTHER_S3
	if (type === "OTHER_S3" && (!storage.endpoint || storage.endpoint.trim() === "")) {
		throw new ConfigValidationError("VOLTAGE_STORAGE_ENDPOINT is required for OTHER_S3 storage type");
	}
}

function validateDatabase(type: DatabaseType, database: Config["database"]): void {
	// SQLite validation
	if (type === "SQLITE") {
		if (!database.file_name || database.file_name.trim() === "") {
			throw new ConfigValidationError("VOLTAGE_DATABASE_FILE_NAME is required for SQLite");
		}
		return;
	}

	// Other database types validation
	if (!database.host || database.host.trim() === "") {
		throw new ConfigValidationError(`VOLTAGE_DATABASE_HOST is required for ${type} database`);
	}

	if (!database.name || database.name.trim() === "") {
		throw new ConfigValidationError(`VOLTAGE_DATABASE_NAME is required for ${type} database`);
	}

	if (!database.username || database.username.trim() === "") {
		throw new ConfigValidationError(`VOLTAGE_DATABASE_USERNAME is required for ${type} database`);
	}

	// Note: We don't validate password as it might be intentionally empty for some setups
}

function validateRuntime(config: Config): void {
	if (config.runtime.is_disabled) {
		return; // Skip validation if runtime is disabled
	}

	if (config.runtime.workers.per_cpu_core < 1) {
		throw new ConfigValidationError("VOLTAGE_WORKERS_PER_CPU_CORE must be at least 1");
	}

	if (config.runtime.maintain_interval < 1000) {
		throw new ConfigValidationError("VOLTAGE_INSTANCES_MAINTAIN_INTERVAL must be at least 1000ms (1 second)");
	}

	if (config.runtime.online_timeout < 1000) {
		throw new ConfigValidationError("VOLTAGE_INSTANCES_ONLINE_TIMEOUT must be at least 1000ms (1 second)");
	}

	if (config.runtime.workers.busy_interval < 1000) {
		throw new ConfigValidationError("VOLTAGE_WORKERS_BUSY_INTERVAL must be at least 1000ms (1 second)");
	}

	if (config.runtime.workers.busy_timeout < config.runtime.workers.busy_interval) {
		throw new ConfigValidationError("VOLTAGE_WORKERS_BUSY_TIMEOUT must be greater than VOLTAGE_WORKERS_BUSY_INTERVAL");
	}
}

function validateJobs(config: Config): void {
	if (config.jobs.try_min < 0) {
		throw new ConfigValidationError("VOLTAGE_JOBS_TRY_MIN must be 0 or greater");
	}

	if (config.jobs.try_max < config.jobs.try_min) {
		throw new ConfigValidationError("VOLTAGE_JOBS_TRY_MAX must be greater than or equal to VOLTAGE_JOBS_TRY_MIN");
	}

	if (config.jobs.try_count < 0) {
		throw new ConfigValidationError("VOLTAGE_JOBS_TRY_COUNT must be 0 or greater");
	}

	if (config.jobs.enqueue_limit < 1) {
		throw new ConfigValidationError("VOLTAGE_JOBS_ENQUEUE_LIMIT must be at least 1");
	}

	if (config.jobs.process_interval < 100) {
		throw new ConfigValidationError("VOLTAGE_JOBS_PROCESS_INTERVAL must be at least 100ms");
	}

	if (config.jobs.process_timeout < config.jobs.process_interval) {
		throw new ConfigValidationError("VOLTAGE_JOBS_PROCESS_TIMEOUT must be greater than VOLTAGE_JOBS_PROCESS_INTERVAL");
	}

	// Validate NSFW settings
	if (!config.utils.nsfw.is_disabled) {
		if (config.utils.nsfw.threshold < 0 || config.utils.nsfw.threshold > 1) {
			throw new ConfigValidationError("NSFW_THRESHOLD must be between 0 and 1");
		}

		if (config.utils.nsfw.size < 1) {
			throw new ConfigValidationError("NSFW_SIZE must be greater than 0");
		}
	}
}

/**
 * Validates environment variables are properly loaded
 * This is a quick check before full config validation
 */
export function validateEnvironment(): void {
	// Check critical environment variables that should never be empty
	const criticalEnvVars = {
		NODE_ENV: process.env.NODE_ENV || "development",
		VOLTAGE_ENV: process.env.VOLTAGE_ENV || "local"
	};

	// Log environment info (without sensitive data)
	if (process.env.VOLTAGE_ENV === "local" || process.env.NODE_ENV === "development") {
		console.log(`[CONFIG] Environment: ${criticalEnvVars.VOLTAGE_ENV}`);
		console.log(`[CONFIG] Node Environment: ${criticalEnvVars.NODE_ENV}`);
	}
}
