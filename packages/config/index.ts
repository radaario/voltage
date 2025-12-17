import type { AppConfig, STORAGE_TYPE, DATABASE_TYPE, FFMPEG_PRESET, NSFW_MODEL, NSFW_TYPE, WHISPER_MODEL, PREVIEW_FORMAT } from "./types";
import { loadEnvironmentFiles, getEnv, getEnvNumber, getEnvNumberOrNull, getEnvBoolean } from "./loader";
import { validateEnvironment, validateConfig } from "./validators";
import { getAppDir, SYSTEM, APP_CONFIG } from "./defaults";

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
const appProtocol = getEnv("VOLTAGE_PROTOCOL", APP_CONFIG.protocol);
const appHost = getEnv("VOLTAGE_HOST", APP_CONFIG.host);
const appPort = getEnvNumber("VOLTAGE_PORT", APP_CONFIG.port);
const appPath = getEnv("VOLTAGE_PATH", APP_CONFIG.path);
const appUrl = `${appProtocol}://${appHost}${appPort !== 80 ? `:${appPort}` : ""}${appPath}`;

const frontendPassword = getEnv("VOLTAGE_FRONTEND_PASSWORD") || null;

// =====================================================
// CONFIGURATION OBJECT
// =====================================================

export const appConfig: AppConfig = {
	// Application basics
	name: getEnv("VOLTAGE_NAME", APP_CONFIG.name),
	version: getEnv("VOLTAGE_VERSION", APP_CONFIG.version),
	env: getEnv("VOLTAGE_ENV", APP_CONFIG.env),
	ngnix_port: getEnvNumber("VOLTAGE_NGINX_PORT", APP_CONFIG.nginxPort),
	url: appUrl,
	protocol: appProtocol,
	host: appHost,
	path: appPath,
	port: appPort,
	timezone: getEnv("VOLTAGE_TIMEZONE", APP_CONFIG.timezone),
	dir: appDir,
	temp_dir: getEnv("VOLTAGE_TEMP_DIR", `${appDir}/storage/tmp`),

	// Utilities configuration
	utils: {
		ffprobe: {
			path: getEnv("VOLTAGE_UTILS_FFPROBE_PATH", APP_CONFIG.utils.ffprobe.path),
			general_attributes: getEnv("VOLTAGE_UTILS_FFPROBE_GENERAL_ATTRIBUTES", APP_CONFIG.utils.ffprobe.generalAttributes),
			video_attributes: getEnv("VOLTAGE_UTILS_FFPROBE_VIDEO_ATTRIBUTES", APP_CONFIG.utils.ffprobe.videoAttributes),
			audio_attributes: getEnv("VOLTAGE_UTILS_FFPROBE_AUDIO_ATTRIBUTES", APP_CONFIG.utils.ffprobe.audioAttributes)
		},
		ffmpeg: {
			path: getEnv("VOLTAGE_UTILS_FFMPEG_PATH", APP_CONFIG.utils.ffmpeg.path),
			preset: getEnv("VOLTAGE_UTILS_FFMPEG_PRESET", APP_CONFIG.utils.ffmpeg.preset) as FFMPEG_PRESET,
			quality: getEnvNumber("VOLTAGE_UTILS_FFMPEG_QUALITY", APP_CONFIG.utils.ffmpeg.quality)
		},
		nsfw: {
			model: getEnv("VOLTAGE_UTILS_NSFW_MODEL", APP_CONFIG.utils.nsfw.model) as NSFW_MODEL,
			size: getEnvNumber("VOLTAGE_UTILS_NSFW_SIZE", APP_CONFIG.utils.nsfw.size),
			type: getEnv("VOLTAGE_UTILS_NSFW_TYPE", APP_CONFIG.utils.nsfw.type) as NSFW_TYPE,
			threshold: getEnvNumber("VOLTAGE_UTILS_NSFW_THRESHOLD", APP_CONFIG.utils.nsfw.threshold)
		},
		whisper: {
			model: getEnv("VOLTAGE_UTILS_WHISPER_MODEL", APP_CONFIG.utils.whisper.model) as WHISPER_MODEL,
			with_cuda: getEnvBoolean("VOLTAGE_UTILS_WHISPER_WITH_CUDA", APP_CONFIG.utils.whisper.with_cuda)
		}
	},

	// Storage configuration
	storage: {
		type: getEnv("VOLTAGE_STORAGE_TYPE", APP_CONFIG.storage.type) as STORAGE_TYPE,
		endpoint: getEnv("VOLTAGE_STORAGE_ENDPOINT", APP_CONFIG.storage.endpoint),
		access_key: getEnv("VOLTAGE_STORAGE_ACCESS_KEY", APP_CONFIG.storage.accessKey),
		access_secret: getEnv("VOLTAGE_STORAGE_ACCESS_SECRET", APP_CONFIG.storage.accessSecret),
		region: getEnv("VOLTAGE_STORAGE_REGION", APP_CONFIG.storage.region),
		bucket: getEnv("VOLTAGE_STORAGE_BUCKET", APP_CONFIG.storage.bucket),
		host: getEnv("VOLTAGE_STORAGE_HOST", APP_CONFIG.storage.host),
		username: getEnv("VOLTAGE_STORAGE_USERNAME", APP_CONFIG.storage.username),
		password: getEnv("VOLTAGE_STORAGE_PASSWORD", APP_CONFIG.storage.password),
		secure: getEnvBoolean("VOLTAGE_STORAGE_SECURE", APP_CONFIG.storage.secure),
		base_path: getEnv("VOLTAGE_STORAGE_BASE_PATH", `${appDir}/storage`)
	},

	// Database configuration
	database: {
		type: getEnv("VOLTAGE_DATABASE_TYPE", APP_CONFIG.database.type) as DATABASE_TYPE,
		host: getEnv("VOLTAGE_DATABASE_HOST", APP_CONFIG.database.host),
		port: getEnvNumber("VOLTAGE_DATABASE_PORT", APP_CONFIG.database.port),
		username: getEnv("VOLTAGE_DATABASE_USERNAME", APP_CONFIG.database.username),
		password: getEnv("VOLTAGE_DATABASE_PASSWORD", APP_CONFIG.database.password),
		name: getEnv("VOLTAGE_DATABASE_NAME", APP_CONFIG.database.name),
		table_prefix: getEnv("VOLTAGE_DATABASE_TABLE_PREFIX", APP_CONFIG.database.tablePrefix),
		file_name: getEnv("VOLTAGE_DATABASE_FILE_NAME", APP_CONFIG.database.fileName),
		cleanup_interval: getEnvNumber("VOLTAGE_DATABASE_CLEANUP_INTERVAL", APP_CONFIG.database.cleanupInterval)
	},

	// Runtime configuration
	runtime: {
		is_disabled: getEnvBoolean("VOLTAGE_RUNTIME_IS_DISABLED", APP_CONFIG.runtime.isDisabled),
		key_method: getEnv("VOLTAGE_INSTANCES_KEY_METHOD", APP_CONFIG.runtime.keyMethod),
		maintain_interval: getEnvNumber("VOLTAGE_INSTANCES_MAINTAIN_INTERVAL", APP_CONFIG.runtime.maintainInterval),
		online_timeout: getEnvNumber("VOLTAGE_INSTANCES_ONLINE_TIMEOUT", APP_CONFIG.runtime.onlineTimeout),
		purge_after: getEnvNumber("VOLTAGE_INSTANCES_PURGE_AFTER", APP_CONFIG.runtime.purgeAfter),
		workers: {
			per_cpu_core: getEnvNumber("VOLTAGE_WORKERS_PER_CPU_CORE", APP_CONFIG.runtime.workers.perCpuCore),
			max: SYSTEM.cpuCoresCount * getEnvNumber("VOLTAGE_WORKERS_PER_CPU_CORE", APP_CONFIG.runtime.workers.perCpuCore),
			busy_interval: getEnvNumber("VOLTAGE_WORKERS_BUSY_INTERVAL", APP_CONFIG.runtime.workers.busyInterval),
			busy_timeout: getEnvNumber("VOLTAGE_WORKERS_BUSY_TIMEOUT", APP_CONFIG.runtime.workers.busyTimeout),
			idle_after: getEnvNumber("VOLTAGE_WORKERS_IDLE_AFTER", APP_CONFIG.runtime.workers.idleAfter)
		}
	},

	// API configuration
	api: {
		is_disabled: getEnvBoolean("VOLTAGE_API_IS_DISABLED", APP_CONFIG.api.isDisabled),
		url: getEnv("VOLTAGE_HOST")
			? `${appUrl}/api`
			: `http://localhost:${getEnvNumber("VOLTAGE_API_NODE_PORT", APP_CONFIG.api.nodePort)}`,
		node_port: getEnvNumber("VOLTAGE_API_NODE_PORT", APP_CONFIG.api.nodePort),
		key: getEnv("VOLTAGE_API_KEY") || APP_CONFIG.api.key,
		request_body_limit: getEnvNumber("VOLTAGE_API_REQUEST_BODY_LIMIT", APP_CONFIG.api.requestBodyLimit),
		auth_rate_limit: {
			window_ms: getEnvNumber("VOLTAGE_API_AUTH_RATE_LIMIT_WINDOW_MS", APP_CONFIG.api.authRateLimit.windowMs),
			max_requests: getEnvNumber("VOLTAGE_API_AUTH_RATE_LIMIT_MAX_REQUESTS", APP_CONFIG.api.authRateLimit.maxRequests)
		},
		sensitive_fields: getEnv("VOLTAGE_API_SENSITIVE_FIELDS", APP_CONFIG.api.sensitiveFields)
	},

	// Frontend configuration
	frontend: {
		is_disabled: getEnvBoolean("VOLTAGE_FRONTEND_IS_DISABLED", APP_CONFIG.frontend.isDisabled),
		url: getEnv("VOLTAGE_HOST")
			? appUrl
			: `http://localhost:${getEnvNumber("VOLTAGE_FRONTEND_NODE_PORT", APP_CONFIG.frontend.nodePort)}`,
		node_port: getEnvNumber("VOLTAGE_FRONTEND_NODE_PORT", APP_CONFIG.frontend.nodePort),
		is_authentication_required: frontendPassword !== null,
		password: frontendPassword,
		data_refetch_interval: getEnvNumber("VOLTAGE_FRONTEND_DATA_REFETCH_INTERVAL", APP_CONFIG.frontend.dataRefetchInterval),
		datetime_format: getEnv("VOLTAGE_FRONTEND_DATETIME_FORMAT", APP_CONFIG.frontend.datetimeFormat),
		local_storage: {
			prefix: getEnv("VOLTAGE_FRONTEND_LOCAL_STORAGE_PREFIX") || APP_CONFIG.frontend.localStorage.prefix
		}
	},

	// Stats configuration
	stats: {
		retention: getEnvNumber("VOLTAGE_STATS_RETENTION", APP_CONFIG.stats.retention)
	},

	// Logs configuration
	logs: {
		is_disabled: getEnvBoolean("VOLTAGE_LOGS_IS_DISABLED", APP_CONFIG.logs.isDisabled),
		retention: getEnvNumber("VOLTAGE_LOGS_RETENTION", APP_CONFIG.logs.retention)
	},

	// Jobs configuration
	jobs: {
		queue_timeout: getEnvNumber("VOLTAGE_JOBS_QUEUE_TIMEOUT", APP_CONFIG.jobs.queueTimeout),
		process_interval: getEnvNumber("VOLTAGE_JOBS_PROCESS_INTERVAL", APP_CONFIG.jobs.processInterval),
		process_timeout: getEnvNumber("VOLTAGE_JOBS_PROCESS_TIMEOUT", APP_CONFIG.jobs.processTimeout),
		enqueue_on_receive: getEnvBoolean("VOLTAGE_JOBS_ENQUEUE_ON_RECEIVE", APP_CONFIG.jobs.enqueueOnReceive),
		enqueue_limit: getEnvNumber("VOLTAGE_JOBS_ENQUEUE_LIMIT", APP_CONFIG.jobs.enqueueLimit),
		retention: getEnvNumber("VOLTAGE_JOBS_RETENTION", APP_CONFIG.jobs.retention),
		input_analysis: getEnvBoolean("VOLTAGE_JOBS_INPUT_ANALYSIS", APP_CONFIG.jobs.inputAnalysis),
		preview_generation: getEnvBoolean("VOLTAGE_JOBS_PREVIEW_GENERATION", APP_CONFIG.jobs.previewGeneration),
		nsfw_detection: getEnvBoolean("VOLTAGE_JOBS_NSFW_DETECTION", APP_CONFIG.jobs.nsfwDetection),
		priority: getEnvNumber("VOLTAGE_JOBS_PRIORITY", APP_CONFIG.jobs.priority),
		try: getEnvNumber("VOLTAGE_JOBS_TRY", APP_CONFIG.jobs.try),
		try_min: getEnvNumber("VOLTAGE_JOBS_TRY_MIN", APP_CONFIG.jobs.tryMin),
		try_max: getEnvNumber("VOLTAGE_JOBS_TRY_MAX", APP_CONFIG.jobs.tryMax),
		retry_in: getEnvNumber("VOLTAGE_JOBS_RETRY_IN", APP_CONFIG.jobs.retryIn),
		retry_in_min: getEnvNumber("VOLTAGE_JOBS_RETRY_IN_MIN", APP_CONFIG.jobs.retryInMin),
		retry_in_max: getEnvNumber("VOLTAGE_JOBS_RETRY_IN_MAX", APP_CONFIG.jobs.retryInMax),
		preview: {
			format: getEnv("VOLTAGE_JOBS_PREVIEW_FORMAT", APP_CONFIG.jobs.preview.format) as PREVIEW_FORMAT,
			quality: getEnvNumber("VOLTAGE_JOBS_PREVIEW_QUALITY", APP_CONFIG.jobs.preview.quality)
		},
		outputs: {
			process_interval: getEnvNumber("VOLTAGE_JOBS_OUTPUTS_PROCESS_INTERVAL", APP_CONFIG.jobs.outputs.processInterval)
		},
		notifications: {
			process_interval: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_PROCESS_INTERVAL", APP_CONFIG.jobs.notifications.processInterval),
			process_limit: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_PROCESS_LIMIT", APP_CONFIG.jobs.notifications.processLimit),
			notify_on: getEnv("VOLTAGE_JOB_NOTIFICATIONS_NOTIFY_ON", APP_CONFIG.jobs.notifications.notifyOn),
			notify_on_alloweds: getEnv("VOLTAGE_JOB_NOTIFICATIONS_NOTIFY_ON_ALLOWEDS", APP_CONFIG.jobs.notifications.notifyOnAlloweds),
			timeout: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TIMEOUT", APP_CONFIG.jobs.notifications.timeout),
			timeout_max: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TIMEOUT_MAX", APP_CONFIG.jobs.notifications.timeoutMax),
			try: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TRY", APP_CONFIG.jobs.notifications.try),
			try_min: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TRY_MIN", APP_CONFIG.jobs.notifications.tryMin),
			try_max: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TRY_MAX", APP_CONFIG.jobs.notifications.tryMax),
			retry_in: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_RETRY_IN", APP_CONFIG.jobs.notifications.retryIn),
			retry_in_min: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_RETRY_IN_MIN", APP_CONFIG.jobs.notifications.retryInMin),
			retry_in_max: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_RETRY_IN_MAX", APP_CONFIG.jobs.notifications.retryInMax)
		}
	}
};

// =====================================================
// VALIDATE CONFIGURATION
// =====================================================

validateConfig(appConfig);

// =====================================================
// EXPORTS
// =====================================================

// Re-export types for convenience
export * from "./types";
export * from "./defaults";
