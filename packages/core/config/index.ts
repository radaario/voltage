import {
	FFMPEG_PRESETS,
	NSFW_MODELS,
	WHISPER_MODELS,
	STORAGE_TYPES,
	NSFW_TYPES,
	DATABASE_TYPES,
	INSTANCE_KEY_METHODS,
	PREVIEW_FORMATS,
	NOTIFICATION_NOTIFY_ON_DEFAULT,
	NOTIFICATION_NOTIFY_ON_TYPES
} from "../constants";

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
import { validateEnvironment, validateConfig } from "./helpers/validators";
import { getAppDir, getAppVersion, isWindows, cpuCoresCount } from "./helpers/system";

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
const appProtocol = getEnv("VOLTAGE_PROTOCOL", "http");
const appHost = getEnv("VOLTAGE_HOST", "localhost");
const appPort = getEnvNumber("VOLTAGE_PORT", 8080);
const appPath = getEnv("VOLTAGE_PATH", "/");
const appUrl = `${appProtocol}://${appHost}${appPort !== 80 ? `:${appPort}` : ""}${appPath}`;

const frontendNodePort = getEnvNumber("VOLTAGE_FRONTEND_NODE_PORT", 3000);
const frontendPassword = getEnv("VOLTAGE_FRONTEND_PASSWORD") || null;

const apiNodePort = getEnvNumber("VOLTAGE_API_NODE_PORT", 4000);

// =====================================================
// CONFIGURATION OBJECT
// =====================================================

export const config = {
	// Application basics
	name: getEnv("VOLTAGE_NAME", "VOLTAGE"),
	version: getEnv("VOLTAGE_VERSION", getAppVersion()),
	env: getEnv("VOLTAGE_ENV", "local"),
	ngnix_port: getEnvNumber("VOLTAGE_NGINX_PORT", 8080),
	url: appUrl,
	protocol: appProtocol,
	host: appHost,
	path: appPath,
	port: appPort,
	timezone: getEnv("VOLTAGE_TIMEZONE", "UTC"),
	dir: appDir,
	temp_dir: getEnv("VOLTAGE_TEMP_DIR", `${appDir}/storage/tmp`),

	// Utilities configuration
	utils: {
		ffprobe: {
			path: getEnv("VOLTAGE_UTILS_FFPROBE_PATH", isWindows ? "C:\\ffmpeg\\bin\\ffprobe" : "ffprobe"),
			general_attributes: getEnvOrNull("VOLTAGE_UTILS_FFPROBE_GENERAL_ATTRIBUTES", null), // e.g., "DURATION"
			video_attributes: getEnvOrNull("VOLTAGE_UTILS_FFPROBE_VIDEO_ATTRIBUTES", null), // e.g., "WIDTH,HEIGHT,CODEC,FRAME_RATE,BIT_RATE"
			audio_attributes: getEnvOrNull("VOLTAGE_UTILS_FFPROBE_AUDIO_ATTRIBUTES", null) // e.g., "CODEC,CHANNELS,SAMPLE_RATE,CHANNEL_LAYOUT,BIT_RATE"
		},
		ffmpeg: {
			path: getEnv("VOLTAGE_UTILS_FFMPEG_PATH", isWindows ? "C:\\ffmpeg\\bin\\ffmpeg" : "ffmpeg"),
			threads: getEnvNumberOrNull("VOLTAGE_UTILS_FFMPEG_THREADS", null), // e.g., number of threads to use
			preset: getEnv("VOLTAGE_UTILS_FFMPEG_PRESET", FFMPEG_PRESETS[0]) as FFMPEG_PRESET, // e.g., "DEFAULT", "MEDIUM", "ULTRA_FAST", "SUPER_FAST", "VERY_FAST", "FASTER", "FAST", "SLOW", "SLOWER"
			quality: getEnvNumberOrNull("VOLTAGE_UTILS_FFMPEG_QUALITY", null), // e.g., CRF value like 0 - 100
			bit_rate_min: getEnvOrNull("VOLTAGE_UTILS_FFMPEG_BIT_RATE_MIN", null), // e.g., in bps
			bit_rate_max: getEnvOrNull("VOLTAGE_UTILS_FFMPEG_BIT_RATE_MAX", null) // e.g., in bps
		},
		nsfw: {
			model: getEnv("VOLTAGE_UTILS_NSFW_MODEL", NSFW_MODELS[0]) as NSFW_MODEL, // e.g., "MOBILE_NET_V2", "MOBILE_NET_V2_MID", "INCEPTION_V3"
			size: getEnvNumber("VOLTAGE_UTILS_NSFW_SIZE", 224),
			type: getEnv("VOLTAGE_UTILS_NSFW_TYPE", NSFW_TYPES[0]) as NSFW_TYPE, // e.g., "GRAPH", "LITE"
			threshold: getEnvNumber("VOLTAGE_UTILS_NSFW_THRESHOLD", 70) // e.g., 0 - 100
		},
		whisper: {
			model: getEnv("VOLTAGE_UTILS_WHISPER_MODEL", WHISPER_MODELS[0]) as WHISPER_MODEL, // e.g., "BASE", "BASE_EN", "TINY", "TINY_EN", "SMALL", "SMALL_EN", "MEDIUM", "MEDIUM_EN", "LARGE", "LARGE_V1", "LARGE_V3_TURBO"
			with_cuda: getEnvBoolean("VOLTAGE_UTILS_WHISPER_WITH_CUDA", false)
		}
	},

	// Storage configuration
	storage: {
		type: getEnv("VOLTAGE_STORAGE_TYPE", STORAGE_TYPES[0]) as STORAGE_TYPE, // e.g., "LOCAL", "AWS_S3", "GOOGLE_CLOUD_STORAGE", "DO_SPACES", "FTP", "SFTP", etc.
		endpoint: getEnvOrNull("VOLTAGE_STORAGE_ENDPOINT", null), // e.g., "s3.amazonaws.com"
		access_key: getEnvOrNull("VOLTAGE_STORAGE_ACCESS_KEY", null), // e.g., AWS Access Key ID
		access_secret: getEnvOrNull("VOLTAGE_STORAGE_ACCESS_SECRET", null), // e.g., AWS Secret Access Key
		region: getEnvOrNull("VOLTAGE_STORAGE_REGION", null), // e.g., "us-east-1"
		bucket: getEnvOrNull("VOLTAGE_STORAGE_BUCKET", null), // e.g., "my-bucket"
		force_path_style: getEnvBoolean("VOLTAGE_STORAGE_FORCE_PATH_STYLE", false), // e.g., for S3 compatible services
		acl: getEnv("VOLTAGE_STORAGE_ACL", "PUBLIC_READ") as STORAGE_S3_LIKE_ACL, // e.g., "PUBLIC_READ", "PUBLIC_READ_WRITE", "PRIVATE", etc.
		expires_in: getEnvNumberOrNull("VOLTAGE_STORAGE_EXPIRES_IN", null), // e.g., in miliseconds
		cache_control: getEnvOrNull("VOLTAGE_STORAGE_CACHE_CONTROL", null), // e.g., "max-age=3600"
		host: getEnvOrNull("VOLTAGE_STORAGE_HOST", null), // e.g., for FTP/SFTP
		username: getEnvOrNull("VOLTAGE_STORAGE_USERNAME", null), // e.g., for FTP/SFTP
		password: getEnvOrNull("VOLTAGE_STORAGE_PASSWORD", null), // e.g., for FTP/SFTP
		secure: getEnvBoolean("VOLTAGE_STORAGE_SECURE", false), // e.g., for FTP/SFTP
		base_path: getEnv("VOLTAGE_STORAGE_BASE_PATH", `${appDir}/storage`), // e.g., base path for storage
		public_url_base: getEnvOrNull("VOLTAGE_STORAGE_PUBLIC_URL_BASE", null) // e.g., custom public URL base
	},

	// Database configuration
	database: {
		type: getEnv("VOLTAGE_DATABASE_TYPE", DATABASE_TYPES[0]) as DATABASE_TYPE, // e.g., "SQLITE", "MYSQL", "MARIADB", "POSTGRESQL", "MSSQL", etc.
		host: getEnv("VOLTAGE_DATABASE_HOST", "localhost"), // e.g., "localhost"
		port: getEnvNumber("VOLTAGE_DATABASE_PORT", 3306), // e.g., 3306
		username: getEnvOrNull("VOLTAGE_DATABASE_USERNAME", "root"), // e.g., "root"
		password: getEnvOrNull("VOLTAGE_DATABASE_PASSWORD", null), // e.g., "password"
		name: getEnv("VOLTAGE_DATABASE_NAME", "voltage"), // e.g., "voltage"
		table_prefix: getEnvOrNull("VOLTAGE_DATABASE_TABLE_PREFIX", null), // e.g., "voltage_"
		file_name: getEnv("VOLTAGE_DATABASE_FILE_NAME", "db.sqlite"), // e.g., for SQLITE: "db.sqlite"
		cleanup_interval: getEnvNumber("VOLTAGE_DATABASE_CLEANUP_INTERVAL", 60 * 60 * 1000) // 1 hour
	},

	// Runtime configuration
	runtime: {
		is_disabled: getEnvBoolean("VOLTAGE_RUNTIME_IS_DISABLED", false), // Disable runtime entirely
		key_method: getEnv("VOLTAGE_INSTANCES_KEY_METHOD", INSTANCE_KEY_METHODS[0]), // e.g., "IP_ADDRESS", "UNIQUE_KEY"
		maintain_interval: getEnvNumber("VOLTAGE_INSTANCES_MAINTAIN_INTERVAL", 10 * 1000), // 10 seconds
		online_timeout: getEnvNumber("VOLTAGE_INSTANCES_ONLINE_TIMEOUT", 15 * 1000), // 15 seconds
		purge_after: getEnvNumber("VOLTAGE_INSTANCES_PURGE_AFTER", 60 * 1000), // 1 minute
		workers: {
			per_cpu_core: getEnvNumber("VOLTAGE_WORKERS_PER_CPU_CORE", 1), // e.g., 1 worker per CPU core
			max: cpuCoresCount * getEnvNumber("VOLTAGE_WORKERS_PER_CPU_CORE", 1), // e.g., maximum workers
			busy_interval: getEnvNumber("VOLTAGE_WORKERS_BUSY_INTERVAL", 1 * 1000), // 1 second
			busy_timeout: getEnvNumber("VOLTAGE_WORKERS_BUSY_TIMEOUT", 5 * 60 * 1000), // 5 minutes
			idle_after: getEnvNumber("VOLTAGE_WORKERS_IDLE_AFTER", 10 * 1000) // 10 seconds
		}
	},

	// API configuration
	api: {
		is_disabled: getEnvBoolean("VOLTAGE_API_IS_DISABLED", false), // Disable API entirely
		url: getEnv("VOLTAGE_HOST") ? `${appUrl}/api` : `http://localhost:${apiNodePort}`, // API URL
		node_port: apiNodePort, // API Node port
		key: getEnvOrNull("VOLTAGE_API_KEY", null), // API Key for authentication
		request_body_limit: getEnvNumber("VOLTAGE_API_REQUEST_BODY_LIMIT", 0), // in bytes, 0 for unlimited
		auth_rate_limit: {
			window_ms: getEnvNumber("VOLTAGE_API_AUTH_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000), // 15 minutes
			max_requests: getEnvNumber("VOLTAGE_API_AUTH_RATE_LIMIT_MAX_REQUESTS", 5) // limit each IP to 5 requests per windowMs
		},
		sensitive_fields: getEnv("VOLTAGE_API_SENSITIVE_FIELDS", "password,access_secret") // Comma-separated sensitive fields
	},

	// Frontend configuration
	frontend: {
		is_disabled: getEnvBoolean("VOLTAGE_FRONTEND_IS_DISABLED", false), // Disable Frontend entirely
		url: getEnv("VOLTAGE_HOST") ? appUrl : `http://localhost:${frontendNodePort}`, // Frontend URL
		node_port: frontendNodePort, // Frontend Node port
		is_authentication_required: frontendPassword !== null, // Require authentication if password is set
		password: frontendPassword, // Frontend password
		data_refetch_interval: getEnvNumber("VOLTAGE_FRONTEND_DATA_REFETCH_INTERVAL", 10000), // 10 seconds
		datetime_format: getEnv("VOLTAGE_FRONTEND_DATETIME_FORMAT", "YYYY-MM-DD HH:mm:ss"), // e.g., "YYYY-MM-DD HH:mm:ss"
		local_storage: {
			prefix: getEnvOrNull("VOLTAGE_FRONTEND_LOCAL_STORAGE_PREFIX", "voltage") // e.g., "voltage"
		}
	},

	// Stats configuration
	stats: {
		retention: getEnvNumber("VOLTAGE_STATS_RETENTION", 365 * 24 * 60 * 60 * 1000) // 365 days
	},

	// Logs configuration
	logs: {
		is_disabled: getEnvBoolean("VOLTAGE_LOGS_IS_DISABLED", false), // Disable logs entirely
		retention: getEnvNumber("VOLTAGE_LOGS_RETENTION", 60 * 60 * 1000) // 1 hour
	},

	// Jobs configuration
	jobs: {
		queue_timeout: getEnvNumber("VOLTAGE_JOBS_QUEUE_TIMEOUT", 5 * 60 * 1000), // 5 minutes
		process_interval: getEnvNumber("VOLTAGE_JOBS_PROCESS_INTERVAL", 1 * 1000), // 1 second
		process_timeout: getEnvNumber("VOLTAGE_JOBS_PROCESS_TIMEOUT", 30 * 60 * 1000), // 30 minutes
		enqueue_on_receive: getEnvBoolean("VOLTAGE_JOBS_ENQUEUE_ON_RECEIVE", true), // Enqueue job immediately on receive
		enqueue_limit: getEnvNumber("VOLTAGE_JOBS_ENQUEUE_LIMIT", 10), // Max jobs to enqueue at once
		retention: getEnvNumber("VOLTAGE_JOBS_RETENTION", 24 * 60 * 60 * 1000), // 24 hours
		input_analysis: getEnvBoolean("VOLTAGE_JOBS_INPUT_ANALYSIS", true), // Analyze job input
		preview_generation: getEnvBoolean("VOLTAGE_JOBS_PREVIEW_GENERATION", true), // Generate preview for job input
		nsfw_detection: getEnvBoolean("VOLTAGE_JOBS_NSFW_DETECTION", false), // NSFW detection for job input
		priority: getEnvNumber("VOLTAGE_JOBS_PRIORITY", 1000), // Default job priority
		try: getEnvNumber("VOLTAGE_JOBS_TRY", 3), // Number of job retry attempts
		try_min: getEnvNumber("VOLTAGE_JOBS_TRY_MIN", 1), // Minimum number of job retry attempts
		try_max: getEnvNumber("VOLTAGE_JOBS_TRY_MAX", 3), // Maximum number of job retry attempts
		retry_in: getEnvNumber("VOLTAGE_JOBS_RETRY_IN", 1 * 60 * 1000), // 1 minute
		retry_in_min: getEnvNumber("VOLTAGE_JOBS_RETRY_IN_MIN", 1 * 60 * 1000), // 1 minute
		retry_in_max: getEnvNumber("VOLTAGE_JOBS_RETRY_IN_MAX", 60 * 60 * 1000), // 60 minutes
		preview: {
			format: getEnv("VOLTAGE_JOBS_PREVIEW_FORMAT", PREVIEW_FORMATS[0]) as PREVIEW_FORMAT, // e.g., "PNG", "JPG", "BMP", "WEBP"
			quality: getEnvNumberOrNull("VOLTAGE_JOBS_PREVIEW_QUALITY", 75) // e.g., 0 - 100
		},
		outputs: {
			process_interval: getEnvNumber("VOLTAGE_JOBS_OUTPUTS_PROCESS_INTERVAL", 10 * 1000) // 10 seconds
		},
		notifications: {
			process_interval: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_PROCESS_INTERVAL", 1 * 1000), // 1 second
			process_limit: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_PROCESS_LIMIT", 10), // 10 notifications at once
			notify_on: getEnv("VOLTAGE_JOB_NOTIFICATIONS_NOTIFY_ON", NOTIFICATION_NOTIFY_ON_DEFAULT.join(",")), // e.g., "RECEIVED,COMPLETED,FAILED,TIMEOUT"
			notify_on_alloweds: getEnv("VOLTAGE_JOB_NOTIFICATIONS_NOTIFY_ON_ALLOWEDS", NOTIFICATION_NOTIFY_ON_TYPES.join(",")), // e.g., "RECEIVED,PENDING,RETRYING,QUEUED,STARTED,DOWNLOADING,DOWNLOADED,ANALYZING,ANALYZED,PROCESSING,PROCESSED,UPLOADING,UPLOADED,COMPLETED,CANCELLED,DELETED,FAILED,TIMEOUT"
			timeout: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TIMEOUT", 10 * 1000), // 10 seconds
			timeout_max: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TIMEOUT_MAX", 30 * 1000), // 30 seconds
			try: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TRY", 3), // Number of notification retry attempts
			try_min: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TRY_MIN", 1), // Minimum number of notification retry attempts
			try_max: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_TRY_MAX", 3), // Maximum number of notification retry attempts
			retry_in: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_RETRY_IN", 1 * 60 * 1000), // 1 minute
			retry_in_min: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_RETRY_IN_MIN", 1 * 60 * 1000), // 1 minute
			retry_in_max: getEnvNumber("VOLTAGE_JOB_NOTIFICATIONS_RETRY_IN_MAX", 60 * 60 * 1000) // 60 minutes
		}
	}
};

// =====================================================
// VALIDATE CONFIGURATION
// =====================================================

validateConfig(config);
