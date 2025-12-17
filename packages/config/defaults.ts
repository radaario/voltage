import os from "os";
import path from "path";
import { readFileSync } from "fs";

const isWindows = os.platform() === "win32";
const cpuCoresCount = os.cpus().length;

// Base paths
export const getAppDir = () => path.resolve(process.cwd(), "../..");

// Read version from root package.json
const getAppVersion = () => {
	try {
		const rootPackageJsonPath = path.join(getAppDir(), "package.json");
		const packageJson = JSON.parse(readFileSync(rootPackageJsonPath, "utf-8"));
		return packageJson.version || "1.0.0";
	} catch (error) {
		console.warn("Failed to read version from root package.json, using default");
		return "1.0.0";
	}
};

// System defaults
export const SYSTEM = {
	isWindows,
	cpuCoresCount
};

export const HTTPS_TYPES = ["HTTP", "HTTPS"] as const;
export const BASE64_TYPES = ["BASE64"] as const;

export const STORAGE_S3_LIKE_TYPES = [
	"OTHER_S3",
	"AWS_S3",
	"GOOGLE_CLOUD_STORAGE",
	"DO_SPACES",
	"LINODE",
	"WASABI",
	"BACKBLAZE",
	"RACKSPACE",
	"MICROSOFT_AZURE"
] as const;

export const STORAGE_S3_LIKE_ACLS = [
	"PUBLIC_READ",
	"PUBLIC_READ_WRITE",
	"AUTHENTICATED_READ",
	"AWS_EXEC_READ",
	"BUCKET_OWNER_READ",
	"BUCKET_OWNER_FULL_CONTROL",
	"PRIVATE"
] as const;

export const STORAGE_FTP_TYPES = ["FTP", "SFTP"] as const;

export const STORAGE_TYPES = ["LOCAL", ...STORAGE_S3_LIKE_TYPES, ...STORAGE_FTP_TYPES] as const;

export const DATABASE_TYPES = ["SQLITE", "MYSQL", "MARIADB", "POSTGRESQL", "MSSQL", "AWS_REDSHIFT", "COCKROACHDB"] as const;

export const INSTANCE_KEY_METHODS = ["IP_ADDRESS", "UNIQUE_KEY"] as const;

export const FFMPEG_PRESETS = ["MEDIUM", "ULTRA_FAST", "SUPER_FAST", "VERY_FAST", "FASTER", "FAST", "SLOW", "SLOWER"] as const;
export const NSFW_MODELS = ["MOBILE_NET_V2", "MOBILE_NET_V2_MID", "INCEPTION_V3"] as const;
export const NSFW_TYPES = ["GRAPH", "LITE"] as const;
export const WHISPER_MODELS = [
	"BASE",
	"BASE_EN",
	"TINY",
	"TINY_EN",
	"SMALL",
	"SMALL_EN",
	"MEDIUM",
	"MEDIUM_EN",
	"LARGE",
	"LARGE_V1",
	"LARGE_V3_TURBO"
] as const;

export const PREVIEW_FORMATS = ["PNG", "JPG", "BMP", "WEBP"] as const;

export const FIT_MODES = ["PAD", "STRETCH", "CROP", "MAX"] as const;
export const ROTATE_MODES = [90, -90, 180, -180] as const;
export const FLIP_MODES = ["HORIZONTAL", "VERTICAL", "BOTH"] as const;

export const VIDEO_FORMATS = [
	"MP4",
	"WEBM",
	"OGV",
	"MOV",
	"AVI",
	"WMV",
	"ASF",
	"FLV",
	"MKV",
	"TS",
	"M2TS",
	"MPG",
	"MPEG",
	"GIF",
	"RAW"
] as const;

export const VIDEO_CODECS = [
	"LIB_X_264",
	"LIB_X_265",
	"LIB_VPX",
	"LIB_VPX_VP9",
	"LIB_AOM_AV1",
	"MPEG_4",
	"MPEG_2_VIDEO",
	"H264_NVENC",
	"HEVC_NVENC",
	"H264_QSV",
	"HEVC_QSV",
	"H264_VAAPI",
	"COPY",
	"PRORES",
	"DNXHD",
	"FFV_1",
	"UTVIDEO"
] as const;
export const VIDEO_PROFILES = ["MAIN", "BASELINE", "HIGH", "HIGH_10", "HIGH_422", "HIGH_444"] as const;
export const VIDEO_PIXEL_FORMATS = [
	"YUV_420_P",
	"YUV_422_P",
	"YUV_444_P",
	"YUV_422_P101E",
	"YUV_444_P101E",
	"NV_12",
	"NV_21",
	"RGB_24",
	"BGR_24",
	"RGBA",
	"BGRA",
	"ARGB",
	"GBRP",
	"GRAY",
	"GRAY_161_E",
	"CUDA",
	"VAAPI",
	"QSV",
	"DXVA2_VLD",
	"VIDEO_TOOL_BOX"
] as const;
export const VIDEO_LEVELS = [1.0, 1.1, 1.2, 1.3, 2.0, 2.1, 2.2, 3.0, 3.1, 3.2, 4.0, 4.1, 4.2, 5.0, 5.1, 5.2, 6.0, 6.1, 6.2] as const;

export const AUDIO_FORMATS = ["MP3", "AAC", "WAV", "FLAC", "OGG", "OPUS", "ALAC", "WMA", "AIFF", "AMR-NB", "AMR-WB"] as const;
export const AUDIO_CODECS = [
	"LIB_MP3_LAME",
	"PCM_S16_LE",
	"PCM_S24_LE",
	"PCM_S32_LE",
	"FLAC",
	"ALAC",
	"WAVPACK",
	"AAC",
	"LIB_OPUS",
	"LIB_VORBIS",
	"AC3",
	"EAC3",
	"MP2",
	"WMAV2"
] as const;
export const AUDIO_CHANNELS = [2, 1, 4, 6, 8] as const;

export const THUMBNAIL_FORMATS = ["PNG", "JPG", "WEBP", "BMP"] as const;

export const SUBTITLE_FORMATS = ["SRT", "VTT", "JSON", "CSV", "TXT"] as const;

export const NOTIFICATION_NOTIFY_ON_TYPES = [
	"RECEIVED",
	"PENDING",
	"RETRYING",
	"QUEUED",
	"STARTED",
	"DOWNLOADING",
	"DOWNLOADED",
	"ANALYZING",
	"ANALYZED",
	"PROCESSING",
	"PROCESSED",
	"UPLOADING",
	"UPLOADED",
	"COMPLETED",
	"CANCELLED",
	"DELETED",
	"FAILED",
	"TIMEOUT"
] as const;

export const NOTIFICATION_NOTIFY_ON_DEFAULT = ["RECEIVED", "COMPLETED", "FAILED", "TIMEOUT"] as const;

// Application configuration defaults
export const APP_CONFIG = {
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
