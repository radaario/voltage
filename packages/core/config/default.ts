import { getAppVersion, isWindows } from "./helpers/system";
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

// Application configuration defaults
export const DEFAULT = {
	name: "VOLTAGE",
	version: getAppVersion(),
	env: "local",
	protocol: "http",
	host: "localhost",
	port: 8080,
	path: "/",
	nginxPort: 8080,
	timezone: "UTC",
	utils: {
		ffprobe: {
			path: isWindows ? "C:\\ffmpeg\\bin\\ffprobe" : "ffprobe",
			generalAttributes: "", // e.g., "DURATION"
			videoAttributes: "", // e.g., "WIDTH,HEIGHT,CODEC_NAME,BITRATE"
			audioAttributes: "" // e.g., "CHANNELS,SAMPLE_RATE,CHANNEL_LAYOUT,CODEC_NAME,BITRATE"
		},
		ffmpeg: {
			path: isWindows ? "C:\\ffmpeg\\bin\\ffmpeg" : "ffmpeg",
			preset: FFMPEG_PRESETS[0], // e.g., "MEDIUM", "ULTRA_FAST", "SUPER_FAST", "VERY_FAST", "FASTER", "FAST", "SLOW", "SLOWER"
			quality: 75 // 0-100 where higher is better quality
		},
		nsfw: {
			model: NSFW_MODELS[0], // e.g., "MOBILE_NET_V2_MID", "MOBILE_NET_V2", "INCEPTION_V3"
			size: 224, // e.g., 224, 299
			type: NSFW_TYPES[0], // e.g., "GRAPH" or "LITE"
			threshold: 70 // 0-100 where higher is more strict
		},
		whisper: {
			model: WHISPER_MODELS[0], // e.g., "TINY", "TINY_EN", "BASE", "BASE_EN", "SMALL", "SMALL_EN", "MEDIUM", "MEDIUM_EN", "LARGE", "LARGE_V1", "LARGE_V3_TURBO"
			with_cuda: false // Whether to use CUDA for GPU acceleration
		}
	},
	storage: {
		type: STORAGE_TYPES[0], // e.g., "LOCAL", "OTHER_S3", "AWS_S3", "GOOGLE_CLOUD_STORAGE", "DO_SPACES", "LINODE", "WASABI", "BACKBLAZE", "RACKSPACE", "MICROSOFT_AZURE", "FTP", "SFTP"
		endpoint: "",
		accessKey: "",
		accessSecret: "",
		region: "",
		bucket: "",
		host: "",
		username: "",
		password: "",
		secure: false
	},
	database: {
		type: DATABASE_TYPES[0], // e.g., "SQLITE", "MYSQL", "MARIADB", "POSTGRESQL", "MSSQL", "AWS_REDSHIFT", "COCKROACHDB"
		host: "localhost",
		port: 3306,
		username: "root",
		password: "",
		name: "voltage",
		tablePrefix: "",
		fileName: "db.sqlite",
		cleanupInterval: 60 * 60 * 1000 // 1 hour
	},
	runtime: {
		isDisabled: false,
		keyMethod: INSTANCE_KEY_METHODS[0], // e.g., "IP_ADDRESS" or "UNIQUE_KEY"
		maintainInterval: 10 * 1000, // 10 seconds
		onlineTimeout: 15 * 1000, // 15 seconds
		purgeAfter: 60 * 1000, // 1 minute
		workers: {
			perCpuCore: 1,
			busyInterval: 1 * 1000, // 1 second
			busyTimeout: 5 * 60 * 1000, // 5 minutes
			idleAfter: 10 * 1000 // 10 seconds
		}
	},
	api: {
		isDisabled: false,
		nodePort: 4000,
		key: null,
		requestBodyLimit: 0,
		authRateLimit: {
			windowMs: 15 * 60 * 1000, // 15 minutes
			maxRequests: 5 // limit each IP to 5 requests per windowMs
		},
		sensitiveFields: "password,access_secret"
	},
	frontend: {
		isDisabled: false,
		nodePort: 3000,
		password: null,
		dataRefetchInterval: 10000, // 10 seconds
		datetimeFormat: "YYYY-MM-DD HH:mm:ss",
		localStorage: {
			prefix: "voltage"
		}
	},
	stats: {
		retention: 365 * 24 * 60 * 60 * 1000 // 365 days
	},
	logs: {
		isDisabled: false,
		retention: 60 * 60 * 1000 // 1 hour
	},
	jobs: {
		queueTimeout: 5 * 60 * 1000, // 5 minutes
		processInterval: 1 * 1000, // 1 second
		processTimeout: 30 * 60 * 1000, // 30 minutes
		enqueueOnReceive: true,
		enqueueLimit: 10,
		retention: 24 * 60 * 60 * 1000, // 24 hours
		inputAnalysis: true,
		previewGeneration: true,
		nsfwDetection: false,
		priority: 1000,
		try: 3,
		tryMin: 1,
		tryMax: 3,
		retryIn: 1 * 60 * 1000, // 1 minute
		retryInMin: 1 * 60 * 1000, // 1 minute
		retryInMax: 60 * 60 * 1000, // 60 minutes
		preview: {
			format: PREVIEW_FORMATS[0], // e.g., "PNG", "JPG", "BMP", "WEBP"
			quality: 75
		},
		outputs: {
			processInterval: 10 * 1000 // 10 seconds
		},
		notifications: {
			processInterval: 1 * 1000, // 1 second
			processLimit: 10,
			notifyOn: NOTIFICATION_NOTIFY_ON_DEFAULT.join(","),
			notifyOnAlloweds: NOTIFICATION_NOTIFY_ON_TYPES.join(","),
			timeout: 10 * 1000, // 10 seconds
			timeoutMax: 30 * 1000, // 30 seconds
			try: 3,
			tryMin: 1,
			tryMax: 3,
			retryIn: 1 * 60 * 1000, // 1 minute
			retryInMin: 1 * 60 * 1000, // 1 minute
			retryInMax: 60 * 60 * 1000 // 60 minutes
		}
	}
};
