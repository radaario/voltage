import type { Config, StorageType, DatabaseType, InstanceKeyMethod, NSFWModel, WhisperModel, PreviewFormat } from "./types";
import { loadEnvironmentFiles, getEnv, getEnvNumber, getEnvBoolean } from "./loader";
import { validateEnvironment, validateConfig } from "./validators";
import {
	getAppDir,
	SYSTEM_DEFAULTS,
	APP_DEFAULTS,
	STORAGE_DEFAULTS,
	DATABASE_DEFAULTS,
	RUNTIME_DEFAULTS,
	API_DEFAULTS,
	FRONTEND_DEFAULTS,
	STATS_DEFAULTS,
	LOGS_DEFAULTS,
	JOBS_DEFAULTS,
	UTILS_DEFAULTS
} from "./defaults";

// =====================================================
// ENVIRONMENT SETUP
// =====================================================

// Load environment variables
loadEnvironmentFiles();
validateEnvironment();

// =====================================================
// APPLICATION VARIABLES
// =====================================================

const appDir = getAppDir();
const appProtocol = getEnv("VOLTAGE_PROTOCOL", APP_DEFAULTS.protocol);
const appHost = getEnv("VOLTAGE_HOST", APP_DEFAULTS.host);
const appPort = getEnvNumber("VOLTAGE_PORT", APP_DEFAULTS.port);
const appPath = getEnv("VOLTAGE_PATH", APP_DEFAULTS.path);
const appUrl = `${appProtocol}://${appHost}${appPort !== 80 ? `:${appPort}` : ""}${appPath}`;

const frontendPassword = getEnv("VOLTAGE_FRONTEND_PASSWORD") || null;

// =====================================================
// CONFIGURATION OBJECT
// =====================================================

export const config: Config = {
	// Application basics
	name: getEnv("VOLTAGE_NAME", APP_DEFAULTS.name),
	version: getEnv("VOLTAGE_VERSION", APP_DEFAULTS.version),
	env: getEnv("VOLTAGE_ENV", APP_DEFAULTS.env),
	ngnix_port: getEnvNumber("VOLTAGE_NGINX_PORT", APP_DEFAULTS.nginxPort),
	url: appUrl,
	protocol: appProtocol,
	host: appHost,
	path: appPath,
	port: appPort,
	timezone: getEnv("VOLTAGE_TIMEZONE", APP_DEFAULTS.timezone),
	dir: appDir,
	temp_dir: getEnv("VOLTAGE_TEMP_DIR", `${appDir}/storage/tmp`),

	// Utilities configuration
	utils: {
		ffmpeg: {
			path: getEnv("FFMPEG_PATH", SYSTEM_DEFAULTS.ffmpegPath)
		},
		ffprobe: {
			path: getEnv("FFPROBE_PATH", SYSTEM_DEFAULTS.ffprobePath)
		},
		nsfw: {
			is_disabled: getEnvBoolean("NSFW_IS_DISABLED", UTILS_DEFAULTS.nsfw.isDisabled),
			model: getEnv("NSFW_MODEL", UTILS_DEFAULTS.nsfw.model) as NSFWModel,
			size: getEnvNumber("NSFW_SIZE", UTILS_DEFAULTS.nsfw.size),
			type: getEnv("NSFW_TYPE", UTILS_DEFAULTS.nsfw.type) as "GRAPH",
			threshold: getEnvNumber("NSFW_THRESHOLD", UTILS_DEFAULTS.nsfw.threshold)
		},
		whisper: {
			model: getEnv("WHISPER_MODEL", UTILS_DEFAULTS.whisper.model) as WhisperModel,
			cuda: getEnvBoolean("WHISPER_CUDA", UTILS_DEFAULTS.whisper.cuda)
		}
	},

	// Storage configuration
	storage: {
		type: getEnv("VOLTAGE_STORAGE_TYPE", STORAGE_DEFAULTS.type) as StorageType,
		endpoint: getEnv("VOLTAGE_STORAGE_ENDPOINT", STORAGE_DEFAULTS.endpoint),
		access_key: getEnv("VOLTAGE_STORAGE_ACCESS_KEY", STORAGE_DEFAULTS.accessKey),
		access_secret: getEnv("VOLTAGE_STORAGE_ACCESS_SECRET", STORAGE_DEFAULTS.accessSecret),
		region: getEnv("VOLTAGE_STORAGE_REGION", STORAGE_DEFAULTS.region),
		bucket: getEnv("VOLTAGE_STORAGE_BUCKET", STORAGE_DEFAULTS.bucket),
		host: getEnv("VOLTAGE_STORAGE_HOST", STORAGE_DEFAULTS.host),
		username: getEnv("VOLTAGE_STORAGE_USERNAME", STORAGE_DEFAULTS.username),
		password: getEnv("VOLTAGE_STORAGE_PASSWORD", STORAGE_DEFAULTS.password),
		secure: getEnvBoolean("VOLTAGE_STORAGE_SECURE", STORAGE_DEFAULTS.secure),
		base_path: getEnv("VOLTAGE_STORAGE_BASE_PATH", `${appDir}/storage`)
	},

	// Database configuration
	database: {
		type: getEnv("VOLTAGE_DATABASE_TYPE", DATABASE_DEFAULTS.type) as DatabaseType,
		host: getEnv("VOLTAGE_DATABASE_HOST", DATABASE_DEFAULTS.host),
		port: getEnvNumber("VOLTAGE_DATABASE_PORT", DATABASE_DEFAULTS.port),
		username: getEnv("VOLTAGE_DATABASE_USERNAME", DATABASE_DEFAULTS.username),
		password: getEnv("VOLTAGE_DATABASE_PASSWORD", DATABASE_DEFAULTS.password),
		name: getEnv("VOLTAGE_DATABASE_NAME", DATABASE_DEFAULTS.name),
		table_prefix: getEnv("VOLTAGE_DATABASE_TABLE_PREFIX", DATABASE_DEFAULTS.tablePrefix),
		file_name: getEnv("VOLTAGE_DATABASE_FILE_NAME", DATABASE_DEFAULTS.fileName),
		cleanup_interval: getEnvNumber("VOLTAGE_DATABASE_CLEANUP_INTERVAL", DATABASE_DEFAULTS.cleanupInterval)
	},

	// Runtime configuration
	runtime: {
		is_disabled: getEnvBoolean("VOLTAGE_RUNTIME_IS_DISABLED", RUNTIME_DEFAULTS.isDisabled),
		key_method: getEnv("VOLTAGE_INSTANCES_KEY_METHOD", RUNTIME_DEFAULTS.keyMethod) as InstanceKeyMethod,
		maintain_interval: getEnvNumber("VOLTAGE_INSTANCES_MAINTAIN_INTERVAL", RUNTIME_DEFAULTS.maintainInterval),
		online_timeout: getEnvNumber("VOLTAGE_INSTANCES_ONLINE_TIMEOUT", RUNTIME_DEFAULTS.onlineTimeout),
		purge_after: getEnvNumber("VOLTAGE_INSTANCES_PURGE_AFTER", RUNTIME_DEFAULTS.purgeAfter),
		workers: {
			per_cpu_core: getEnvNumber("VOLTAGE_WORKERS_PER_CPU_CORE", RUNTIME_DEFAULTS.workers.perCpuCore),
			max: SYSTEM_DEFAULTS.cpuCoresCount * getEnvNumber("VOLTAGE_WORKERS_PER_CPU_CORE", RUNTIME_DEFAULTS.workers.perCpuCore),
			busy_interval: getEnvNumber("VOLTAGE_WORKERS_BUSY_INTERVAL", RUNTIME_DEFAULTS.workers.busyInterval),
			busy_timeout: getEnvNumber("VOLTAGE_WORKERS_BUSY_TIMEOUT", RUNTIME_DEFAULTS.workers.busyTimeout),
			idle_after: getEnvNumber("VOLTAGE_WORKERS_IDLE_AFTER", RUNTIME_DEFAULTS.workers.idleAfter)
		}
	},

	// API configuration
	api: {
		is_disabled: getEnvBoolean("VOLTAGE_API_IS_DISABLED", API_DEFAULTS.isDisabled),
		url: getEnv("VOLTAGE_HOST") ? `${appUrl}/api` : `http://localhost:${getEnvNumber("VOLTAGE_API_NODE_PORT", API_DEFAULTS.nodePort)}`,
		node_port: getEnvNumber("VOLTAGE_API_NODE_PORT", API_DEFAULTS.nodePort),
		key: getEnv("VOLTAGE_API_KEY") || API_DEFAULTS.key,
		request_body_limit: getEnvNumber("VOLTAGE_API_REQUEST_BODY_LIMIT", API_DEFAULTS.requestBodyLimit),
		auth_rate_limit: {
			window_ms: getEnvNumber("VOLTAGE_API_AUTH_RATE_LIMIT_WINDOW_MS", API_DEFAULTS.authRateLimit.windowMs),
			max_requests: getEnvNumber("VOLTAGE_API_AUTH_RATE_LIMIT_MAX_REQUESTS", API_DEFAULTS.authRateLimit.maxRequests)
		},
		sensitive_fields: getEnv("VOLTAGE_API_SENSITIVE_FIELDS", API_DEFAULTS.sensitiveFields)
	},

	// Frontend configuration
	frontend: {
		is_disabled: getEnvBoolean("VOLTAGE_FRONTEND_IS_DISABLED", FRONTEND_DEFAULTS.isDisabled),
		url: getEnv("VOLTAGE_HOST") ? appUrl : `http://localhost:${getEnvNumber("VOLTAGE_FRONTEND_NODE_PORT", FRONTEND_DEFAULTS.nodePort)}`,
		node_port: getEnvNumber("VOLTAGE_FRONTEND_NODE_PORT", FRONTEND_DEFAULTS.nodePort),
		is_authentication_required: frontendPassword !== null,
		password: frontendPassword,
		data_refetch_interval: getEnvNumber("VOLTAGE_FRONTEND_DATA_REFETCH_INTERVAL", FRONTEND_DEFAULTS.dataRefetchInterval),
		datetime_format: getEnv("VOLTAGE_FRONTEND_DATETIME_FORMAT", FRONTEND_DEFAULTS.datetimeFormat),
		local_storage: {
			prefix: getEnv("VOLTAGE_FRONTEND_LOCAL_STORAGE_PREFIX") || FRONTEND_DEFAULTS.localStorage.prefix
		}
	},

	// Stats configuration
	stats: {
		retention: getEnvNumber("VOLTAGE_STATS_RETENTION", STATS_DEFAULTS.retention)
	},

	// Logs configuration
	logs: {
		is_disabled: getEnvBoolean("VOLTAGE_LOGS_IS_DISABLED", LOGS_DEFAULTS.isDisabled),
		retention: getEnvNumber("VOLTAGE_LOGS_RETENTION", LOGS_DEFAULTS.retention)
	},

	// Jobs configuration
	jobs: {
		queue_timeout: getEnvNumber("VOLTAGE_JOBS_QUEUE_TIMEOUT", JOBS_DEFAULTS.queueTimeout),
		process_interval: getEnvNumber("VOLTAGE_JOBS_PROCESS_INTERVAL", JOBS_DEFAULTS.processInterval),
		process_timeout: getEnvNumber("VOLTAGE_JOBS_PROCESS_TIMEOUT", JOBS_DEFAULTS.processTimeout),
		enqueue_on_receive: getEnvBoolean("VOLTAGE_JOBS_ENQUEUE_ON_RECEIVE", JOBS_DEFAULTS.enqueueOnReceive),
		enqueue_limit: getEnvNumber("VOLTAGE_JOBS_ENQUEUE_LIMIT", JOBS_DEFAULTS.enqueueLimit),
		retention: getEnvNumber("VOLTAGE_JOBS_RETENTION", JOBS_DEFAULTS.retention),
		try_min: getEnvNumber("VOLTAGE_JOBS_TRY_MIN", JOBS_DEFAULTS.tryMin),
		try_max: getEnvNumber("VOLTAGE_JOBS_TRY_MAX", JOBS_DEFAULTS.tryMax),
		try_count: getEnvNumber("VOLTAGE_JOBS_TRY_COUNT", JOBS_DEFAULTS.tryCount),
		retry_in_min: getEnvNumber("VOLTAGE_JOBS_RETRY_IN_MIN", JOBS_DEFAULTS.retryInMin),
		retry_in_max: getEnvNumber("VOLTAGE_JOBS_RETRY_IN_MAX", JOBS_DEFAULTS.retryInMax),
		retry_in: getEnvNumber("VOLTAGE_JOBS_RETRY_IN", JOBS_DEFAULTS.retryIn),
		preview: {
			format: getEnv("VOLTAGE_JOBS_PREVIEW_FORMAT", JOBS_DEFAULTS.preview.format) as PreviewFormat,
			quality: getEnvNumber("VOLTAGE_JOBS_PREVIEW_QUALITY", JOBS_DEFAULTS.preview.quality)
		},
		outputs: {
			process_interval: getEnvNumber("VOLTAGE_JOBS_OUTPUTS_PROCESS_INTERVAL", JOBS_DEFAULTS.outputs.processInterval)
		},
		notifications: {
			process_interval: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_PROCESS_INTERVAL", JOBS_DEFAULTS.notifications.processInterval),
			process_limit: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_PROCESS_LIMIT", JOBS_DEFAULTS.notifications.processLimit),
			notify_on: getEnv("VOLTAGE_JOB_NOTIFICATIONS_NOTIFY_ON", JOBS_DEFAULTS.notifications.notifyOn),
			notify_on_alloweds: getEnv("VOLTAGE_JOB_NOTIFICATIONS_NOTIFY_ON_ALLOWEDS", JOBS_DEFAULTS.notifications.notifyOnAlloweds),
			timeout: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TIMEOUT", JOBS_DEFAULTS.notifications.timeout),
			timeout_max: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TIMEOUT_MAX", JOBS_DEFAULTS.notifications.timeoutMax),
			try: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TRY", JOBS_DEFAULTS.notifications.try),
			try_max: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TRY_MAX", JOBS_DEFAULTS.notifications.tryMax),
			retry_in: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_RETRY_IN", JOBS_DEFAULTS.notifications.retryIn),
			retry_in_max: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_RETRY_IN_MAX", JOBS_DEFAULTS.notifications.retryInMax)
		}
	}
};

// =====================================================
// VALIDATE CONFIGURATION
// =====================================================

validateConfig(config);

// =====================================================
// EXPORTS
// =====================================================

// Re-export types for convenience
export * from "./types";
