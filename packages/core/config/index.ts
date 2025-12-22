import type {
	STORAGE_TYPE,
	DATABASE_TYPE,
	FFMPEG_PRESET,
	NSFW_MODEL,
	NSFW_TYPE,
	WHISPER_MODEL,
	PREVIEW_FORMAT,
	STORAGE_S3_LIKE_ACL
} from "../types";
import { loadEnvironmentFiles, getEnv, getEnvOrNull, getEnvNumber, getEnvNumberOrNull, getEnvBoolean } from "./helpers/loader";
import type { APP_CONFIG } from "./helpers/types";
import { validateEnvironment, validateConfig } from "./helpers/validators";
import { getAppDir, cpuCoresCount } from "./helpers/system";
import { DEFAULT } from "./default";

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
const appProtocol = getEnv("VOLTAGE_PROTOCOL", DEFAULT.protocol);
const appHost = getEnv("VOLTAGE_HOST", DEFAULT.host);
const appPort = getEnvNumber("VOLTAGE_PORT", DEFAULT.port);
const appPath = getEnv("VOLTAGE_PATH", DEFAULT.path);
const appUrl = `${appProtocol}://${appHost}${appPort !== 80 ? `:${appPort}` : ""}${appPath}`;

const frontendPassword = getEnv("VOLTAGE_FRONTEND_PASSWORD") || null;

// =====================================================
// CONFIGURATION OBJECT
// =====================================================

export const config: APP_CONFIG = {
	// Application basics
	name: getEnv("VOLTAGE_NAME", DEFAULT.name),
	version: getEnv("VOLTAGE_VERSION", DEFAULT.version),
	env: getEnv("VOLTAGE_ENV", DEFAULT.env),
	ngnix_port: getEnvNumber("VOLTAGE_NGINX_PORT", DEFAULT.nginxPort),
	url: appUrl,
	protocol: appProtocol,
	host: appHost,
	path: appPath,
	port: appPort,
	timezone: getEnv("VOLTAGE_TIMEZONE", DEFAULT.timezone),
	dir: appDir,
	temp_dir: getEnv("VOLTAGE_TEMP_DIR", `${appDir}/storage/tmp`),

	// Utilities configuration
	utils: {
		ffprobe: {
			path: getEnv("VOLTAGE_UTILS_FFPROBE_PATH", DEFAULT.utils.ffprobe.path),
			general_attributes: getEnv("VOLTAGE_UTILS_FFPROBE_GENERAL_ATTRIBUTES", DEFAULT.utils.ffprobe.generalAttributes),
			video_attributes: getEnv("VOLTAGE_UTILS_FFPROBE_VIDEO_ATTRIBUTES", DEFAULT.utils.ffprobe.videoAttributes),
			audio_attributes: getEnv("VOLTAGE_UTILS_FFPROBE_AUDIO_ATTRIBUTES", DEFAULT.utils.ffprobe.audioAttributes)
		},
		ffmpeg: {
			path: getEnv("VOLTAGE_UTILS_FFMPEG_PATH", DEFAULT.utils.ffmpeg.path),
			preset: getEnv("VOLTAGE_UTILS_FFMPEG_PRESET", DEFAULT.utils.ffmpeg.preset) as FFMPEG_PRESET,
			quality: getEnvNumber("VOLTAGE_UTILS_FFMPEG_QUALITY", DEFAULT.utils.ffmpeg.quality)
		},
		nsfw: {
			model: getEnv("VOLTAGE_UTILS_NSFW_MODEL", DEFAULT.utils.nsfw.model) as NSFW_MODEL,
			size: getEnvNumber("VOLTAGE_UTILS_NSFW_SIZE", DEFAULT.utils.nsfw.size),
			type: getEnv("VOLTAGE_UTILS_NSFW_TYPE", DEFAULT.utils.nsfw.type) as NSFW_TYPE,
			threshold: getEnvNumber("VOLTAGE_UTILS_NSFW_THRESHOLD", DEFAULT.utils.nsfw.threshold)
		},
		whisper: {
			model: getEnv("VOLTAGE_UTILS_WHISPER_MODEL", DEFAULT.utils.whisper.model) as WHISPER_MODEL,
			with_cuda: getEnvBoolean("VOLTAGE_UTILS_WHISPER_WITH_CUDA", DEFAULT.utils.whisper.with_cuda)
		}
	},

	// Storage configuration
	storage: {
		type: getEnv("VOLTAGE_STORAGE_TYPE", DEFAULT.storage.type) as STORAGE_TYPE,
		endpoint: getEnv("VOLTAGE_STORAGE_ENDPOINT", DEFAULT.storage.endpoint),
		access_key: getEnv("VOLTAGE_STORAGE_ACCESS_KEY", DEFAULT.storage.accessKey),
		access_secret: getEnv("VOLTAGE_STORAGE_ACCESS_SECRET", DEFAULT.storage.accessSecret),
		region: getEnv("VOLTAGE_STORAGE_REGION", DEFAULT.storage.region),
		bucket: getEnv("VOLTAGE_STORAGE_BUCKET", DEFAULT.storage.bucket),
		host: getEnv("VOLTAGE_STORAGE_HOST", DEFAULT.storage.host),
		username: getEnv("VOLTAGE_STORAGE_USERNAME", DEFAULT.storage.username),
		password: getEnv("VOLTAGE_STORAGE_PASSWORD", DEFAULT.storage.password),
		secure: getEnvBoolean("VOLTAGE_STORAGE_SECURE", DEFAULT.storage.secure),
		base_path: getEnv("VOLTAGE_STORAGE_BASE_PATH", `${appDir}/storage`),
		acl: getEnv("VOLTAGE_STORAGE_ACL", DEFAULT.storage.acl) as STORAGE_S3_LIKE_ACL,
		expires_in: getEnvNumberOrNull("VOLTAGE_STORAGE_EXPIRES_IN", DEFAULT.storage.expires_in),
		cache_control: getEnvOrNull("VOLTAGE_STORAGE_CACHE_CONTROL", DEFAULT.storage.cache_control)
	},

	// Database configuration
	database: {
		type: getEnv("VOLTAGE_DATABASE_TYPE", DEFAULT.database.type) as DATABASE_TYPE,
		host: getEnv("VOLTAGE_DATABASE_HOST", DEFAULT.database.host),
		port: getEnvNumber("VOLTAGE_DATABASE_PORT", DEFAULT.database.port),
		username: getEnv("VOLTAGE_DATABASE_USERNAME", DEFAULT.database.username),
		password: getEnv("VOLTAGE_DATABASE_PASSWORD", DEFAULT.database.password),
		name: getEnv("VOLTAGE_DATABASE_NAME", DEFAULT.database.name),
		table_prefix: getEnv("VOLTAGE_DATABASE_TABLE_PREFIX", DEFAULT.database.tablePrefix),
		file_name: getEnv("VOLTAGE_DATABASE_FILE_NAME", DEFAULT.database.fileName),
		cleanup_interval: getEnvNumber("VOLTAGE_DATABASE_CLEANUP_INTERVAL", DEFAULT.database.cleanupInterval)
	},

	// Runtime configuration
	runtime: {
		is_disabled: getEnvBoolean("VOLTAGE_RUNTIME_IS_DISABLED", DEFAULT.runtime.isDisabled),
		key_method: getEnv("VOLTAGE_INSTANCES_KEY_METHOD", DEFAULT.runtime.keyMethod),
		maintain_interval: getEnvNumber("VOLTAGE_INSTANCES_MAINTAIN_INTERVAL", DEFAULT.runtime.maintainInterval),
		online_timeout: getEnvNumber("VOLTAGE_INSTANCES_ONLINE_TIMEOUT", DEFAULT.runtime.onlineTimeout),
		purge_after: getEnvNumber("VOLTAGE_INSTANCES_PURGE_AFTER", DEFAULT.runtime.purgeAfter),
		workers: {
			per_cpu_core: getEnvNumber("VOLTAGE_WORKERS_PER_CPU_CORE", DEFAULT.runtime.workers.perCpuCore),
			max: cpuCoresCount * getEnvNumber("VOLTAGE_WORKERS_PER_CPU_CORE", DEFAULT.runtime.workers.perCpuCore),
			busy_interval: getEnvNumber("VOLTAGE_WORKERS_BUSY_INTERVAL", DEFAULT.runtime.workers.busyInterval),
			busy_timeout: getEnvNumber("VOLTAGE_WORKERS_BUSY_TIMEOUT", DEFAULT.runtime.workers.busyTimeout),
			idle_after: getEnvNumber("VOLTAGE_WORKERS_IDLE_AFTER", DEFAULT.runtime.workers.idleAfter)
		}
	},

	// API configuration
	api: {
		is_disabled: getEnvBoolean("VOLTAGE_API_IS_DISABLED", DEFAULT.api.isDisabled),
		url: getEnv("VOLTAGE_HOST") ? `${appUrl}/api` : `http://localhost:${getEnvNumber("VOLTAGE_API_NODE_PORT", DEFAULT.api.nodePort)}`,
		node_port: getEnvNumber("VOLTAGE_API_NODE_PORT", DEFAULT.api.nodePort),
		key: getEnv("VOLTAGE_API_KEY") || DEFAULT.api.key,
		request_body_limit: getEnvNumber("VOLTAGE_API_REQUEST_BODY_LIMIT", DEFAULT.api.requestBodyLimit),
		auth_rate_limit: {
			window_ms: getEnvNumber("VOLTAGE_API_AUTH_RATE_LIMIT_WINDOW_MS", DEFAULT.api.authRateLimit.windowMs),
			max_requests: getEnvNumber("VOLTAGE_API_AUTH_RATE_LIMIT_MAX_REQUESTS", DEFAULT.api.authRateLimit.maxRequests)
		},
		sensitive_fields: getEnv("VOLTAGE_API_SENSITIVE_FIELDS", DEFAULT.api.sensitiveFields)
	},

	// Frontend configuration
	frontend: {
		is_disabled: getEnvBoolean("VOLTAGE_FRONTEND_IS_DISABLED", DEFAULT.frontend.isDisabled),
		url: getEnv("VOLTAGE_HOST") ? appUrl : `http://localhost:${getEnvNumber("VOLTAGE_FRONTEND_NODE_PORT", DEFAULT.frontend.nodePort)}`,
		node_port: getEnvNumber("VOLTAGE_FRONTEND_NODE_PORT", DEFAULT.frontend.nodePort),
		is_authentication_required: frontendPassword !== null,
		password: frontendPassword,
		data_refetch_interval: getEnvNumber("VOLTAGE_FRONTEND_DATA_REFETCH_INTERVAL", DEFAULT.frontend.dataRefetchInterval),
		datetime_format: getEnv("VOLTAGE_FRONTEND_DATETIME_FORMAT", DEFAULT.frontend.datetimeFormat),
		local_storage: {
			prefix: getEnv("VOLTAGE_FRONTEND_LOCAL_STORAGE_PREFIX") || DEFAULT.frontend.localStorage.prefix
		}
	},

	// Stats configuration
	stats: {
		retention: getEnvNumber("VOLTAGE_STATS_RETENTION", DEFAULT.stats.retention)
	},

	// Logs configuration
	logs: {
		is_disabled: getEnvBoolean("VOLTAGE_LOGS_IS_DISABLED", DEFAULT.logs.isDisabled),
		retention: getEnvNumber("VOLTAGE_LOGS_RETENTION", DEFAULT.logs.retention)
	},

	// Jobs configuration
	jobs: {
		queue_timeout: getEnvNumber("VOLTAGE_JOBS_QUEUE_TIMEOUT", DEFAULT.jobs.queueTimeout),
		process_interval: getEnvNumber("VOLTAGE_JOBS_PROCESS_INTERVAL", DEFAULT.jobs.processInterval),
		process_timeout: getEnvNumber("VOLTAGE_JOBS_PROCESS_TIMEOUT", DEFAULT.jobs.processTimeout),
		enqueue_on_receive: getEnvBoolean("VOLTAGE_JOBS_ENQUEUE_ON_RECEIVE", DEFAULT.jobs.enqueueOnReceive),
		enqueue_limit: getEnvNumber("VOLTAGE_JOBS_ENQUEUE_LIMIT", DEFAULT.jobs.enqueueLimit),
		retention: getEnvNumber("VOLTAGE_JOBS_RETENTION", DEFAULT.jobs.retention),
		input_analysis: getEnvBoolean("VOLTAGE_JOBS_INPUT_ANALYSIS", DEFAULT.jobs.inputAnalysis),
		preview_generation: getEnvBoolean("VOLTAGE_JOBS_PREVIEW_GENERATION", DEFAULT.jobs.previewGeneration),
		nsfw_detection: getEnvBoolean("VOLTAGE_JOBS_NSFW_DETECTION", DEFAULT.jobs.nsfwDetection),
		priority: getEnvNumber("VOLTAGE_JOBS_PRIORITY", DEFAULT.jobs.priority),
		try: getEnvNumber("VOLTAGE_JOBS_TRY", DEFAULT.jobs.try),
		try_min: getEnvNumber("VOLTAGE_JOBS_TRY_MIN", DEFAULT.jobs.tryMin),
		try_max: getEnvNumber("VOLTAGE_JOBS_TRY_MAX", DEFAULT.jobs.tryMax),
		retry_in: getEnvNumber("VOLTAGE_JOBS_RETRY_IN", DEFAULT.jobs.retryIn),
		retry_in_min: getEnvNumber("VOLTAGE_JOBS_RETRY_IN_MIN", DEFAULT.jobs.retryInMin),
		retry_in_max: getEnvNumber("VOLTAGE_JOBS_RETRY_IN_MAX", DEFAULT.jobs.retryInMax),
		preview: {
			format: getEnv("VOLTAGE_JOBS_PREVIEW_FORMAT", DEFAULT.jobs.preview.format) as PREVIEW_FORMAT,
			quality: getEnvNumber("VOLTAGE_JOBS_PREVIEW_QUALITY", DEFAULT.jobs.preview.quality)
		},
		outputs: {
			process_interval: getEnvNumber("VOLTAGE_JOBS_OUTPUTS_PROCESS_INTERVAL", DEFAULT.jobs.outputs.processInterval)
		},
		notifications: {
			process_interval: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_PROCESS_INTERVAL", DEFAULT.jobs.notifications.processInterval),
			process_limit: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_PROCESS_LIMIT", DEFAULT.jobs.notifications.processLimit),
			notify_on: getEnv("VOLTAGE_JOB_NOTIFICATIONS_NOTIFY_ON", DEFAULT.jobs.notifications.notifyOn),
			notify_on_alloweds: getEnv("VOLTAGE_JOB_NOTIFICATIONS_NOTIFY_ON_ALLOWEDS", DEFAULT.jobs.notifications.notifyOnAlloweds),
			timeout: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TIMEOUT", DEFAULT.jobs.notifications.timeout),
			timeout_max: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TIMEOUT_MAX", DEFAULT.jobs.notifications.timeoutMax),
			try: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TRY", DEFAULT.jobs.notifications.try),
			try_min: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TRY_MIN", DEFAULT.jobs.notifications.tryMin),
			try_max: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TRY_MAX", DEFAULT.jobs.notifications.tryMax),
			retry_in: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_RETRY_IN", DEFAULT.jobs.notifications.retryIn),
			retry_in_min: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_RETRY_IN_MIN", DEFAULT.jobs.notifications.retryInMin),
			retry_in_max: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_RETRY_IN_MAX", DEFAULT.jobs.notifications.retryInMax)
		}
	}
};

// =====================================================
// VALIDATE CONFIGURATION
// =====================================================

validateConfig(config);
